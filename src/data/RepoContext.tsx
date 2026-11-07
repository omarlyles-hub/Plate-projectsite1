import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type Settings } from '../core/types';
import type { Repository } from './repo';

const RepoContext = createContext<Repository | null>(null);

export function RepoProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  return <RepoContext.Provider value={repo}>{children}</RepoContext.Provider>;
}

export function useRepo(): Repository {
  const repo = useContext(RepoContext);
  if (!repo) throw new Error('useRepo must be used inside RepoProvider');
  return repo;
}

/**
 * Runs an async query and re-runs it whenever the repository changes.
 * Returns undefined until the first result arrives.
 */
export function useLiveQuery<T>(
  query: (repo: Repository) => Promise<T>,
  deps: readonly unknown[] = [],
): T | undefined {
  const repo = useRepo();
  const [version, setVersion] = useState(0);
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => repo.onChange(() => setVersion((v) => v + 1)), [repo]);

  useEffect(() => {
    let cancelled = false;
    query(repo).then((v) => {
      if (!cancelled) setValue(v);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, version, ...deps]);

  return value;
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<void>] {
  const repo = useRepo();
  const stored = useLiveQuery((r) => r.getSettings());
  const update = async (patch: Partial<Settings>) => {
    const current = await repo.getSettings();
    await repo.saveSettings({ ...current, ...patch });
  };
  return [stored ?? DEFAULT_SETTINGS, update];
}
