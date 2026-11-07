import { useEffect, useRef, useState } from 'react';
import type { MealCandidate, VenueCandidate } from '../../core/types';
import { confirmCandidate, type Enrichment, type VenueChoice } from '../../data/confirmMeal';
import { useLiveQuery, useRepo } from '../../data/RepoContext';
import { formatDay } from '../format';
import { go } from '../router';
import { Empty } from '../shared/bits';
import { PhotoStrip } from '../shared/Photo';
import { EnrichSheet } from './EnrichSheet';
import { SwipeCard, type SwipeDir, type SwipeHandle } from './SwipeCard';

type Choice = number | 'manual';
interface Selection {
  id: string;
  choice: Choice;
  name: string;
}

const defaultChoice = (card: MealCandidate): Choice =>
  card.candidates.length === 0 || card.candidates[0].needsManualName ? 'manual' : 0;

const distanceLabel = (m: number) => (m <= 0 ? '' : m < 1000 ? `${Math.round(m)} m away` : `${(m / 1000).toFixed(1)} km away`);

function CardFace({
  card,
  sel,
  setSel,
  venueNames,
}: {
  card: MealCandidate;
  sel: Selection;
  setSel: (s: Selection) => void;
  venueNames: string[];
}) {
  const real = card.candidates.filter((c) => !c.needsManualName);
  const chosen: VenueCandidate | undefined = sel.choice === 'manual' ? undefined : card.candidates[sel.choice];
  const title = sel.choice === 'manual' ? sel.name.trim() || 'Name this place' : chosen?.name ?? '';
  const hood = chosen?.neighborhood ?? card.candidates[0]?.neighborhood ?? '';

  return (
    <>
      <div className="media">
        <PhotoStrip ids={card.photoIds} alt={`Photos from ${formatDay(card.date)}`} />
      </div>
      <div className="info">
        <div className="small muted">
          {formatDay(card.date)}
          {hood ? ` · ${hood}` : ''}
        </div>
        <div className="venue-name" style={{ fontSize: '1.5rem' }}>{title}</div>
        <div className="candidates" role="radiogroup" aria-label="Which restaurant?">
          {real.map((c) => {
            const idx = card.candidates.indexOf(c);
            return (
              <button
                key={c.mapItemId ?? c.name}
                role="radio"
                aria-checked={sel.choice === idx}
                aria-pressed={sel.choice === idx}
                className="candidate"
                onClick={() => setSel({ ...sel, choice: idx })}
              >
                <span style={{ fontWeight: 600 }}>{c.name}</span>{' '}
                <span className="muted small">
                  {[c.knownVenueId ? 'been before' : '', distanceLabel(c.distanceM)].filter(Boolean).join(' · ')}
                </span>
              </button>
            );
          })}
          <button
            role="radio"
            aria-checked={sel.choice === 'manual'}
            aria-pressed={sel.choice === 'manual'}
            className="candidate"
            onClick={() => setSel({ ...sel, choice: 'manual' })}
          >
            Somewhere else…
          </button>
          {sel.choice === 'manual' && (
            <>
              <input
                className="input"
                placeholder="Restaurant name"
                aria-label="Restaurant name"
                list="known-venues"
                value={sel.name}
                autoComplete="off"
                onChange={(e) => setSel({ ...sel, name: e.target.value })}
              />
              <datalist id="known-venues">
                {venueNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function TriageView() {
  const repo = useRepo();
  const queue = useLiveQuery((r) => r.listCandidates('pending'));
  const venues = useLiveQuery((r) => r.listVenues());
  const handle = useRef<SwipeHandle>(null);

  const [sel, setSel] = useState<Selection>();
  const [enriching, setEnriching] = useState<{ card: MealCandidate; choice: VenueChoice; name: string }>();
  const [resetKey, setResetKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; undo?: () => void }>();
  const [error, setError] = useState<string>();

  const top = queue?.[0];
  const next = queue?.[1];
  const current: Selection | undefined = top
    ? sel?.id === top.id
      ? sel
      : { id: top.id, choice: defaultChoice(top), name: '' }
    : undefined;

  const canConfirm = !!top && !!current && (current.choice !== 'manual' || current.name.trim().length > 0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Keyboard: arrows mirror the swipe gestures.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (enriching || (e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === 'ArrowRight') handle.current?.commit('right');
      if (e.key === 'ArrowLeft') handle.current?.commit('left');
      if (e.key === 'ArrowDown') handle.current?.commit('down');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enriching]);

  const decide = (dir: SwipeDir) => {
    if (!top || !current) return;
    if (dir === 'right') {
      const choice: VenueChoice =
        current.choice === 'manual'
          ? { kind: 'manual', name: current.name }
          : { kind: 'candidate', candidate: top.candidates[current.choice] };
      const name = choice.kind === 'manual' ? choice.name.trim() : choice.candidate.name;
      setEnriching({ card: top, choice, name });
      return;
    }
    const status = dir === 'left' ? 'skipped' : 'dismissed';
    const id = top.id;
    void repo.setCandidateStatus(id, status).then(() =>
      setToast({
        text: dir === 'left' ? 'Skipped' : 'Dismissed as not a restaurant meal',
        undo: () => void repo.setCandidateStatus(id, 'pending'),
      }),
    );
  };

  const save = async (e: Enrichment) => {
    if (!enriching) return;
    setSaving(true);
    setError(undefined);
    try {
      await confirmCandidate(repo, enriching.card, enriching.choice, e);
      setEnriching(undefined);
      setToast({ text: `Saved ${enriching.name}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const cancelEnrich = () => {
    setEnriching(undefined);
    setResetKey((k) => k + 1); // bring the swiped-away card back
  };

  return (
    <div className="triage">
      <div className="triage-top">
        <button className="back" style={{ padding: 0 }} onClick={() => go('import')}>
          &larr; Done
        </button>
        <span className="muted small" aria-live="polite">
          {queue ? `${queue.length} left` : ''}
        </span>
      </div>

      {queue && queue.length === 0 ? (
        <div className="card" style={{ marginTop: 24 }}>
          <Empty title="All caught up">
            Nothing left to review. Your meals are in the Journal.
          </Empty>
          <div className="card-body">
            <button className="btn primary block" onClick={() => go('journal')}>
              Open Journal
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="deck">
            {next && (
              <div className="card swipe-card behind" aria-hidden="true">
                <div className="media">
                  <PhotoStrip ids={next.photoIds} />
                </div>
                <div className="info">
                  <div className="venue-name">{next.candidates[0]?.name}</div>
                </div>
              </div>
            )}
            {top && current && (
              <SwipeCard
                key={`${top.id}:${resetKey}`}
                handle={handle}
                onDecide={decide}
                canConfirm={canConfirm}
              >
                <CardFace
                  card={top}
                  sel={current}
                  setSel={setSel}
                  venueNames={(venues ?? []).map((v) => v.name)}
                />
              </SwipeCard>
            )}
          </div>

          <div className="actions">
            <button className="btn" onClick={() => handle.current?.commit('left')}>
              Skip
            </button>
            <button className="btn danger" onClick={() => handle.current?.commit('down')}>
              Not a meal
            </button>
            <button className="btn primary" disabled={!canConfirm} onClick={() => handle.current?.commit('right')}>
              Confirm
            </button>
          </div>
          <p className="muted small" style={{ textAlign: 'center', margin: '12px 0 0' }}>
            Swipe right to confirm, left to skip, down if it isn&apos;t a restaurant meal.
          </p>
        </>
      )}

      {enriching && (
        <>
          <EnrichSheet
            venueName={enriching.name}
            saving={saving}
            onSave={(e) => void save(e)}
            onCancel={cancelEnrich}
          />
          {error && <div className="toast" role="alert">{error}</div>}
        </>
      )}

      {toast && !enriching && (
        <div className="toast" role="status">
          {toast.text}
          {toast.undo && (
            <button
              className="btn ghost"
              style={{ color: 'inherit', textDecoration: 'underline', minHeight: 0, padding: '0 0 0 10px' }}
              onClick={() => {
                toast.undo?.();
                setToast(undefined);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
