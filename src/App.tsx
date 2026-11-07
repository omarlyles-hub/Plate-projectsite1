import { useMemo } from 'react';
import { IdbRepository } from './data/idbRepo';
import { RepoProvider, useLiveQuery } from './data/RepoContext';
import { ImportTab } from './ui/tabs/ImportTab';
import { JournalTab } from './ui/tabs/JournalTab';
import { RecommendTab } from './ui/tabs/RecommendTab';
import { TodayTab } from './ui/tabs/TodayTab';
import { MealDetail } from './ui/journal/MealDetail';
import { VenuePage } from './ui/journal/VenuePage';
import { TriageView } from './ui/triage/TriageView';
import { go, useRoute } from './ui/router';

type TabId = 'today' | 'journal' | 'recommend' | 'import';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17m10-10 1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  { id: 'journal', label: 'Journal', icon: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11M9 8h6' },
  { id: 'recommend', label: 'Recommend', icon: 'M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z' },
  { id: 'import', label: 'Import', icon: 'M12 15V4m0 0L8 8m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' },
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={t.icon} />
            </svg>
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

export function App() {
  const repo = useMemo(() => new IdbRepository(), []);
  return (
    <RepoProvider repo={repo}>
      <Shell />
    </RepoProvider>
  );
}
