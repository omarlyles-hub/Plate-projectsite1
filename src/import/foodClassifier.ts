import type { WorkerIn, WorkerOut } from './foodClassifier.worker';

/** Scores how food-like a photo is, 0..1. */
export interface FoodClassifier {
  classify(blob: Blob): Promise<number>;
  dispose(): void;
}

/** Runs the CLIP model in a Web Worker so the UI stays responsive. */
export function createWorkerClassifier(onModelProgress?: (percent: number) => void): FoodClassifier {
  const worker = new Worker(new URL('./foodClassifier.worker.ts', import.meta.url), {
    type: 'module',
  });
  let nextId = 1;
  const pending = new Map<number, { resolve: (n: number) => void; reject: (e: Error) => void }>();

  worker.onmessage = (event: MessageEvent<WorkerOut>) => {
    const msg = event.data;
    if (msg.type === 'model-progress') {
      onModelProgress?.(msg.progress);
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.type === 'result') entry.resolve(msg.score);
    else entry.reject(new Error(msg.message));
  };

  return {
    classify(blob) {
      const id = nextId++;
      return new Promise<number>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        const msg: WorkerIn = { type: 'classify', id, blob };
        worker.postMessage(msg);
      });
    },
    dispose() {
      worker.terminate();
      pending.forEach((p) => p.reject(new Error('classifier disposed')));
      pending.clear();
    },
  };
}
