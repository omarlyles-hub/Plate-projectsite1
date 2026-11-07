import { useSyncExternalStore } from 'react';
import type { Repository } from '../data/repo';
import { createWorkerClassifier } from './foodClassifier';
import { createOverpassSource } from './overpassSource';
import { runImport, type ImportProgress, type ImportSummary } from './pipeline';
import { readPhotoMeta } from './readExif';
import { makeThumbnail } from './thumbnail';

export interface ImportState {
  running: boolean;
  progress?: ImportProgress;
  summary?: ImportSummary;
  /** 0..100 while the model downloads for the first time, otherwise null. */
  modelProgress: number | null;
  error?: string;
}

let state: ImportState = { running: false, modelProgress: null };
const listeners = new Set<() => void>();
let controller: AbortController | undefined;
const venueSource = createOverpassSource();

function set(patch: Partial<ImportState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

/** Module-level so a scan keeps running (and reporting) while the user switches tabs. */
export const importController = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  cancel() {
    controller?.abort();
  },
  async start(files: File[], repo: Repository, lookupEnabled: boolean) {
    if (state.running) return;
    controller = new AbortController();
    set({ running: true, summary: undefined, error: undefined, progress: undefined, modelProgress: null });
    const classifier = createWorkerClassifier((pct) =>
      set({ modelProgress: pct >= 100 ? null : Math.round(pct) }),
    );
    try {
      const summary = await runImport(
        files,
        {
          repo,
          readMeta: readPhotoMeta,
          makeThumbnail,
          classifier,
          venueSource,
          lookupEnabled,
        },
        (progress) => set({ progress }),
        controller.signal,
      );
      set({ summary });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Import failed' });
    } finally {
      classifier.dispose();
      set({ running: false, modelProgress: null });
    }
  },
};

export function useImportState(): ImportState {
  return useSyncExternalStore(importController.subscribe, importController.getState);
}
