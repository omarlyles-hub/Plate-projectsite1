import type { Session } from '@supabase/supabase-js';
import { useMemo, useState, type CSSProperties } from 'react';
import importIcon from './assets/nav/import.svg';
import journalIcon from './assets/nav/journal.svg';
import recommendIcon from './assets/nav/recommend.svg';
import todayIcon from './assets/nav/today.svg';
import { AuthScreen } from './auth/AuthScreen';
import { ResetPasswordScreen } from './auth/ResetPasswordScreen';
import { useAuth, type AuthApi } from './auth/useAuth';
import { HybridRepository } from './data/hybridRepo';
import { IdbRepository } from './data/idbRepo';
import { RepoProvider, useLiveQuery } from './data/RepoContext';
import { SyncContext, type SyncInfo } from './data/SyncContext';
import { createSupabaseCloud } from './data/supabaseCloud';
import { supabase, supabaseConfigured } from './data/supabaseClient';
import { ImportTab } from './ui/tabs/ImportTab';
import { JournalTab } from './ui/tabs/JournalTab';
import { RecommendTab } from './ui/tabs/RecommendTab';
import { TodayTab } from './ui/tabs/TodayTab';
import { MealDetail } from './ui/journal/MealDetail';
import { VenuePage } from './ui/journal/VenuePage';
import { TriageView } from './ui/triage/TriageView';
import { go, useRoute } from './ui/router';

type TabId = 'today' | 'journal' | 'recommend' | 'import';

// Icons are the SVG files exported from the Figma "Tab bar" component. They are drawn as CSS
// masks so the active/inactive colors come from the theme tokens (and follow dark mode).
// The thumbs-up glyph is 18.15px inside its 22px slot in the design; the rest fill the slot.
const TABS: { id: TabId; label: string; icon: string; iconSize: string }[] = [
  { id: 'today', label: 'Today', icon: todayIcon, iconSize: '22px' },
  { id: 'journal', label: 'Journal', icon: journalIcon, iconSize: '22px' },
  { id: 'recommend', label: 'Recommend', icon: recommendIcon, iconSize: '18.15px' },
  { id: 'import', label: 'Import', icon: importIcon, iconSize: '22px' },
];

function TabBar({ active }: { active: TabId | null }) {
  const pending = useLiveQuery((r) => r.listCandidates('pending'));
  const count = pending?.length ?? 0;
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="tab"
            aria-current={active === t.id ? 'page' : undefined}
            onClick={() => go(t.id)}
          >
            <span
              className="tab-icon"
              aria-hidden="true"
              style={{ '--icon': `url("${t.icon}")`, '--icon-size': t.iconSize } as CSSProperties}
            />
            {t.label}
            {t.id === 'import' && count > 0 && <span className="badge" aria-label={`${count} to review`}>{count}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}

function Shell() {
  const route = useRoute();
  const [section = 'today', arg] = route;

  if (section === 'triage') return <TriageView />;

  let tab: TabId | null = null;
  let body;
  switch (section) {
    case 'journal':
      tab = 'journal';
      body = <JournalTab />;
      break;
    case 'recommend':
      tab = 'recommend';
      body = <RecommendTab />;
      break;
    case 'import':
      tab = 'import';
      body = <ImportTab />;
      break;
    case 'venue':
      tab = 'journal';
      body = arg ? <VenuePage venueId={arg} /> : <JournalTab />;
      break;
    case 'meal':
      tab = 'journal';
      body = arg ? <MealDetail mealId={arg} /> : <JournalTab />;
      break;
    default:
      tab = 'today';
      body = <TodayTab />;
  }

  return (
    <>
      <main className="app">{body}</main>
      <TabBar active={tab} />
    </>
  );
}

// One on-device store for the whole session; the cloud-backed repository wraps it.
let localStore: IdbRepository | undefined;
const getLocal = () => (localStore ??= new IdbRepository());

function LocalApp({ sync }: { sync: SyncInfo }) {
  return (
    <SyncContext.Provider value={sync}>
      <RepoProvider repo={getLocal()}>
        <Shell />
      </RepoProvider>
    </SyncContext.Provider>
  );
}

function CloudApp({ auth, session }: { auth: AuthApi; session: Session }) {
  const [syncError, setSyncError] = useState<string | null>(null);
  const userId = session.user.id;
  const email = session.user.email;
  const signOut = auth.signOut;

  const repo = useMemo(
    () => new HybridRepository(getLocal(), createSupabaseCloud(supabase!), setSyncError),
    // A new user means a new repository; the session object itself changes on token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );
  const sync = useMemo<SyncInfo>(
    () => ({
      kind: 'cloud',
      email,
      syncError,
      signOut,
      pendingLocalCount: () => repo.pendingLocalCount(),
      uploadLocal: () => repo.uploadLocal(),
    }),
    [email, syncError, signOut, repo],
  );

  return (
    <SyncContext.Provider value={sync}>
      <RepoProvider key={userId} repo={repo}>
        <Shell />
      </RepoProvider>
    </SyncContext.Provider>
  );
}

function AuthGate() {
  const auth = useAuth();
  const { status } = auth;
  const localOnly = useMemo<SyncInfo>(() => ({ kind: 'local-only', signIn: auth.showSignIn }), [auth.showSignIn]);

  switch (status.kind) {
    case 'loading':
      return null;
    case 'signed-out':
      return <AuthScreen auth={auth} />;
    case 'recovery':
      return <ResetPasswordScreen auth={auth} email={status.session.user.email} />;
    case 'signed-in':
      return <CloudApp auth={auth} session={status.session} />;
    case 'local-only':
      return <LocalApp sync={localOnly} />;
  }
}

const NO_SYNC: SyncInfo = { kind: 'none' };

export function App() {
  // Without Supabase env vars the app runs fully on-device, exactly as before.
  return supabaseConfigured ? <AuthGate /> : <LocalApp sync={NO_SYNC} />;
}
