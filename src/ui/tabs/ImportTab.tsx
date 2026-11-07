import { useEffect, useRef, useState } from 'react';
import { useRepo, useLiveQuery, useSettings } from '../../data/RepoContext';
import { useSync } from '../../data/SyncContext';
import { seedDemo, DEMO_MEAL_COUNT } from '../../data/seed';
import { importController, useImportState } from '../../import/importController';
import { canPickFolder, isImageFile, pickFolderImages } from '../../import/pickFiles';
import { IMPORT_CONFIG } from '../../import/importConfig';
import { PageHead } from '../shared/bits';
import { go } from '../router';

function PrivacyGate({ onAccept }: { onAccept: () => void }) {
  const sync = useSync();
  return (
    <div className="card">
      <div className="card-body stack">
        <h2 className="serif">Before you import</h2>
        <p style={{ margin: 0 }}>
          Plate looks through photos you choose, finds the ones that look like food and have a
          location, and groups them into meals. Here is exactly what happens:
        </p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <strong>Your photos never leave this device.</strong> Plate keeps only a small
            thumbnail of each food photo, never the original.
          </li>
          <li>
            <strong>One download:</strong> the first scan fetches a food-recognition model (about
            50-90 MB) from Hugging Face. It is then cached and runs on your device.
          </li>
          <li>
            <strong>Venue lookup:</strong> to name the restaurant, each meal&apos;s approximate
            location (rounded to about 11 m) is sent to OpenStreetMap&apos;s public Overpass
            service. No photos or other data are sent. You can switch this off in Settings below
            and type venue names yourself.
          </li>
          {sync.kind === 'cloud' ? (
            <li>
              <strong>Your account:</strong> the meals, venues and dishes you confirm are saved to your
              private Plate account so they sync across devices. Photos and thumbnails are never
              uploaded.
            </li>
          ) : (
            <li>Nothing is uploaded: your journal stays in this browser.</li>
          )}
          <li>No analytics, no tracking.</li>
        </ul>
        <button className="btn primary block" onClick={onAccept}>
          I understand, continue
        </button>
      </div>
    </div>
  );
}

function ImportRun() {
  const repo = useRepo();
  const [settings] = useSettings();
  const state = useImportState();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string>();

  const begin = (files: File[]) => {
    const images = files.filter(isImageFile);
    if (images.length === 0) {
      setMessage('No photos found in that selection.');
      return;
    }
    setMessage(undefined);
    void importController.start(images, repo, settings.venueLookup);
  };

  const p = state.progress;
  const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;

  return (
    <div className="card">
      <div className="card-body stack">
        <h2 className="serif">Scan your photos</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Choose photos from the last {IMPORT_CONFIG.lookbackMonths} months. Only photos with
          location data that look like food are kept. On iPhone, Safari may remove location from
          picked photos; if nothing is found, choose &quot;Options &rarr; Location: Include&quot; in
          the picker, or import from a desktop folder.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            begin(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn primary" disabled={state.running} onClick={() => inputRef.current?.click()}>
            Choose photos
          </button>
          {canPickFolder() && (
            <button
              className="btn"
              disabled={state.running}
              onClick={() => void pickFolderImages().then(begin)}
            >
              Choose a folder
            </button>
          )}
        </div>
        {message && <p className="small" role="status" style={{ margin: 0 }}>{message}</p>}

        {state.running && p && (
          <div className="stack" role="status" aria-live="polite">
            {state.modelProgress !== null && (
              <div>
                <div className="small muted">Downloading food model, one time only… {state.modelProgress}%</div>
                <div className="progress"><div style={{ width: `${state.modelProgress}%` }} /></div>
              </div>
            )}
            <div>
              <div className="small">
                {p.phase === 'reading'
                  ? `Scanning photo ${p.done} of ${p.total}`
                  : `Finding restaurants ${p.done} of ${p.total}`}
              </div>
              <div className="progress"><div style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="small muted">
              {p.kept} food photos kept &middot; {p.skippedNoGps} without location &middot;{' '}
              {p.skippedNotFood} not food
            </div>
            <button className="btn ghost" onClick={() => importController.cancel()}>
              Stop
            </button>
          </div>
        )}

        {!state.running && state.summary && (
          <div className="stack" role="status">
            <div className="hero">
              <strong>
                {state.summary.stoppedReason === 'classifier-failed'
                  ? 'Stopped: the food model could not run.'
                  : state.summary.stoppedReason === 'cancelled'
                    ? 'Stopped early.'
                    : 'Scan complete.'}
              </strong>
              <div className="small" style={{ marginTop: 4 }}>
                {state.summary.kept} food photos &rarr; {state.summary.candidates} meals to review.
                {state.summary.skippedNoGps > 0 &&
                  ` ${state.summary.skippedNoGps} photos had no location.`}
                {state.summary.skippedOutsideWindow > 0 &&
                  ` ${state.summary.skippedOutsideWindow} were older than ${IMPORT_CONFIG.lookbackMonths} months.`}
                {state.summary.skippedAlreadyScanned > 0 &&
                  ` ${state.summary.skippedAlreadyScanned} were already scanned.`}
              </div>
              {state.summary.lookupFailures > 0 && (
                <div className="small" style={{ marginTop: 6 }} role="alert">
                  Couldn&apos;t reach the restaurant lookup for {state.summary.lookupFailures}{' '}
                  {state.summary.lookupFailures === 1 ? 'meal' : 'meals'}, so you&apos;ll type those names
                  while reviewing.
                </div>
              )}
            </div>
          </div>
        )}
        {state.error && <p role="alert" style={{ margin: 0, color: '#b3261e' }}>{state.error}</p>}
      </div>
    </div>
  );
}

function QueueCard() {
  const repo = useRepo();
  const pending = useLiveQuery((r) => r.listCandidates('pending'));
  const skipped = useLiveQuery((r) => r.listCandidates('skipped'));
  const n = pending?.length ?? 0;
  const s = skipped?.length ?? 0;
  return (
    <div className="card">
      <div className="card-body row">
        <div className="grow">
          <div className="serif" style={{ fontSize: '1.3rem' }}>
            {n} {n === 1 ? 'meal' : 'meals'} to review
          </div>
          <div className="small muted">
            {s > 0 ? `${s} skipped. ` : ''}
            Swipe through them in a few seconds each.
          </div>
        </div>
        <button className="btn primary" disabled={n === 0} onClick={() => go('triage')}>
          Review
        </button>
      </div>
      {s > 0 && (
        <div className="card-body" style={{ paddingTop: 0 }}>
          <button
            className="btn ghost"
            onClick={() => void Promise.all((skipped ?? []).map((c) => repo.setCandidateStatus(c.id, 'pending')))}
          >
            Bring back {s} skipped
          </button>
        </div>
      )}
    </div>
  );
}

function AccountCard() {
  const sync = useSync();
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    void sync.pendingLocalCount?.().then((n) => {
      if (!cancelled) setPending(n);
    });
    return () => {
      cancelled = true;
    };
  }, [sync]);

  if (sync.kind === 'none') return null;

  const upload = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const moved = await sync.uploadLocal?.();
      setPending(0);
      setMessage(`Uploaded ${moved ?? 0} ${moved === 1 ? 'meal' : 'meals'} to your account.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-body stack" style={{ gap: 10 }}>
        <h2 className="serif">Account</h2>
        {sync.kind === 'cloud' ? (
          <>
            <div className="small">
              Signed in as <strong>{sync.email}</strong>. Your meals sync to your account; photos stay on
              this device.
            </div>
            {sync.syncError && (
              <p className="small" role="alert" style={{ margin: 0, color: '#b3261e' }}>
                Sync problem: {sync.syncError}
              </p>
            )}
            {pending > 0 && (
              <button className="btn" disabled={busy} onClick={() => void upload()}>
                {busy ? 'Uploading…' : `Upload ${pending} ${pending === 1 ? 'item' : 'items'} from this device`}
              </button>
            )}
            {message && <div className="small" role="status">{message}</div>}
            {error && <div className="small" role="alert" style={{ color: '#b3261e' }}>{error}</div>}
            <button className="btn ghost" onClick={() => void sync.signOut?.()}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <div className="small muted">
              Using this device only. Sign in to sync your meals across devices.
            </div>
            <button className="btn primary" onClick={() => sync.signIn?.()}>
              Sign in or create account
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SettingsCard() {
  const repo = useRepo();
  const [settings, update] = useSettings();
  const sync = useSync();
  const [confirmErase, setConfirmErase] = useState(false);

  const toggleDemo = async (on: boolean) => {
    if (on) await seedDemo(repo);
    else await repo.clearDemo();
    await update({ demoMode: on });
  };

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="serif" style={{ marginBottom: 6 }}>Settings</h2>
        <label className="switch-row">
          <span>
            <strong>Demo mode</strong>
            <div className="small muted">
              Loads {DEMO_MEAL_COUNT} fictional meals across NYC, plus a few cards to swipe. Turning it
              off removes only the demo data.
            </div>
          </span>
          <input
            type="checkbox"
            checked={settings.demoMode}
            onChange={(e) => void toggleDemo(e.target.checked)}
          />
        </label>
        <label className="switch-row">
          <span>
            <strong>Look up restaurants online</strong>
            <div className="small muted">
              Sends rounded meal locations to OpenStreetMap Overpass. Off means you type venue names.
            </div>
          </span>
          <input
            type="checkbox"
            checked={settings.venueLookup}
            onChange={(e) => void update({ venueLookup: e.target.checked })}
          />
        </label>
        <div className="switch-row">
          <span>
            <strong>Erase all data</strong>
            <div className="small muted">
              Deletes your journal, thumbnails and queue from this browser
              {sync.kind === 'cloud' ? ' and from your account' : ''}.
            </div>
          </span>
          {confirmErase ? (
            <span className="row">
              <button
                className="btn danger"
                onClick={() =>
                  void (async () => {
                    await repo.clearAll();
                    await update({ demoMode: false });
                    setConfirmErase(false);
                  })()
                }
              >
                Erase
              </button>
              <button className="btn ghost" onClick={() => setConfirmErase(false)}>Cancel</button>
            </span>
          ) : (
            <button className="btn danger" onClick={() => setConfirmErase(true)}>Erase…</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImportTab() {
  const [settings, update] = useSettings();
  return (
    <>
      <PageHead title="Import" subtitle="Turn old photos into a dining journal." />
      <div className="stack">
        <QueueCard />
        {settings.privacyAccepted ? (
          <ImportRun />
        ) : (
          <PrivacyGate onAccept={() => void update({ privacyAccepted: true })} />
        )}
        <AccountCard />
        <SettingsCard />
      </div>
    </>
  );
}
