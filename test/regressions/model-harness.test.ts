import { it, expect } from 'vitest';
import { ModelHarness } from '../helpers/ModelHarness.js';
it('REG-MODEL-HARNESS-01 indeterminate test setting does not imply save reached IO when no path exists', async () => {
  const h = new ModelHarness();
  await h.run({ request: { command: 'init' } });
  const before = h.reference.status(h.model.state);
  await h.run({ request: { command: 'save' }, outcome: 'indeterminate', physical: true });
  expect(h.reference.status(h.model.state)).toEqual(before);
  expect(h.files.writeCalls).toEqual([]);
  expect(h.coverage['error:NO_SAVE_PATH']).toBe(1);
});
