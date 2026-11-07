/// <reference lib="webworker" />
import { pipeline, RawImage, env } from '@huggingface/transformers';
import { IMPORT_CONFIG } from './importConfig';

export type WorkerIn = { type: 'classify'; id: number; blob: Blob };
export type WorkerOut =
  | { type: 'result'; id: number; score: number }
  | { type: 'error'; id: number; message: string }
  | { type: 'model-progress'; progress: number };

env.allowLocalModels = false;

type Classifier = (
  image: RawImage,
  labels: string[],
  options?: { hypothesis_template?: string },
) => Promise<{ label: string; score: number }[]>;

let classifierPromise: Promise<Classifier> | undefined;

function loadClassifier(): Promise<Classifier> {
  classifierPromise ??= pipeline('zero-shot-image-classification', IMPORT_CONFIG.modelId, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: { status?: string; progress?: number }) => {
      if (p.status === 'progress' && typeof p.progress === 'number') {
        const msg: WorkerOut = { type: 'model-progress', progress: p.progress };
        self.postMessage(msg);
      }
    },
  }) as unknown as Promise<Classifier>;
  return classifierPromise;
}

const LABELS = [...IMPORT_CONFIG.foodLabels, ...IMPORT_CONFIG.nonFoodLabels];
const FOOD = new Set<string>(IMPORT_CONFIG.foodLabels);

self.onmessage = async (event: MessageEvent<WorkerIn>) => {
  const { id, blob } = event.data;
  try {
    const classify = await loadClassifier();
    const image = await RawImage.fromBlob(blob);
    const out = await classify(image, LABELS, { hypothesis_template: 'This is a photo of {}.' });
    const score = out.filter((o) => FOOD.has(o.label)).reduce((sum, o) => sum + o.score, 0);
    const msg: WorkerOut = { type: 'result', id, score };
    self.postMessage(msg);
  } catch (e) {
    const msg: WorkerOut = { type: 'error', id, message: e instanceof Error ? e.message : String(e) };
    self.postMessage(msg);
  }
};
