import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ModelHarness } from '../helpers/ModelHarness.js';
import type { ModelStep } from '../model/types.js';
it('MODEL-09/10 exact concrete minimized requests replay independently of fast-check generator/version', async () => {
  const files = [
    new URL('../fixtures/regressions/model-oracle-01.json', import.meta.url),
    new URL('../fixtures/regressions/model-harness-01.json', import.meta.url),
    ...(process.env.MODEL_REPLAY_FILE ? [process.env.MODEL_REPLAY_FILE] : []),
  ];
  for (const file of files) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as {
      profile?: { maxNodes: number };
      steps?: ModelStep[];
      minimum?: { steps: ModelStep[] };
    };
    const steps = data.steps ?? data.minimum?.steps;
    expect(Array.isArray(steps)).toBe(true);
    expect(steps!.length).toBeGreaterThan(0);
    const h = new ModelHarness(data.profile?.maxNodes ?? 30);
    for (const step of steps!) await h.run(step);
  }
});
