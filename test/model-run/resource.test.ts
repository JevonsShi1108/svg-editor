import { it, expect } from 'vitest';
import { ModelHarness } from '../helpers/ModelHarness.js';
it('MODEL-04/05 resource invalid requests actually execute with Redo and complete status preservation', async () => {
  const h = new ModelHarness(4);
  await h.run({ request: { command: 'init' } });
  for (const id of ['P', 'Q', 'R', 'S'])
    await h.run({ request: { command: 'create', shape: { type: 'g', id } } });
  await h.run({ request: { command: 'front', id: 'P' } });
  await h.run({ request: { command: 'undo' } });
  const before = h.reference.status(h.model.state);
  await h.run({ request: { command: 'group', newId: 'G', ids: ['P', 'Q'] } });
  expect(h.reference.status(h.model.state)).toEqual(before);
  expect(h.coverage['error:RESOURCE_LIMIT']).toBe(1);
  await h.run({ request: { command: 'redo' } });
});
it('MODEL-04/05 final depth model rejects sixth-level create/group and preserves all parent/order state', async () => {
  const h = new ModelHarness(10);
  await h.run({ request: { command: 'init' } });
  for (let i = 0; i < 5; i++)
    await h.run({
      request: {
        command: 'create',
        shape: { type: 'g', id: `d${i}` },
        ...(i ? { parentId: `d${i - 1}` } : {}),
      },
    });
  await h.run({
    request: { command: 'create', shape: { type: 'g', id: 'tooDeep' }, parentId: 'd4' },
  });
  await h.run({ request: { command: 'create', shape: { type: 'g', id: 'side' }, parentId: 'd3' } });
  const before = structuredClone(h.model.state);
  await h.run({ request: { command: 'group', newId: 'G', ids: ['d4', 'side'] } });
  expect(h.model.state).toEqual(before);
  expect(h.coverage['error:RESOURCE_LIMIT']).toBe(2);
});
