import { performance } from 'node:perf_hooks';
export const policy = {
  warmup: 3,
  samples: 11,
  leafBatch: 50,
  sizes: [100, 1000, 5000],
  seed: 20261025,
} as const;
export interface Metric {
  id: string;
  operation: string;
  n: number;
  k: number;
  s: number;
  B: number;
  batch: number;
  medianMs: number;
  p95Ms: number;
  heapBefore: number;
  heapAfter: number;
  heapMaximum: number;
  samplesMs: number[];
}
export const benchmark = async (
  facts: Pick<Metric, 'id' | 'operation' | 'n' | 'k' | 's' | 'B' | 'batch'>,
  operation: () => void | Promise<void>,
): Promise<Metric> => {
  for (let i = 0; i < policy.warmup; i++) await operation();
  const heapBefore = process.memoryUsage().heapUsed;
  let heapMaximum = heapBefore;
  const samplesMs: number[] = [];
  for (let i = 0; i < policy.samples; i++) {
    const start = performance.now();
    await operation();
    samplesMs.push(performance.now() - start);
    heapMaximum = Math.max(heapMaximum, process.memoryUsage().heapUsed);
  }
  const sorted = [...samplesMs].sort((a, b) => a - b);
  return {
    ...facts,
    medianMs: sorted[Math.floor(sorted.length / 2)]!,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    heapBefore,
    heapAfter: process.memoryUsage().heapUsed,
    heapMaximum,
    samplesMs,
  };
};
