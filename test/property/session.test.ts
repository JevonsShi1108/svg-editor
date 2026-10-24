import fc from 'fast-check';
import { it, expect } from 'vitest';
import { sessionFixture, committed, semantic } from '../helpers/session.js';
import { PropertyRunner } from '../helpers/PropertyRunner.js';
import type { EditRequest, CommandRequest } from '../../src/application/contracts/api.js';
const ready = async () => {
  const h = sessionFixture();
  for (const request of [
    { command: 'init' },
    { command: 'create', shape: { type: 'g', id: 'g' } },
    { command: 'create', shape: { type: 'rect', id: 'a', x: 0.1, y: 2, width: 3, height: 4 } },
    { command: 'create', shape: { type: 'circle', id: 'b', cx: 5, cy: 6, r: 7 } },
  ] as CommandRequest[])
    committed(await h.session.execute(request));
  return h;
};
it('PROP-01 every successful edit undo precisely restores before semantics', () =>
  PropertyRunner.checkAsync(
    'PROP-01',
    fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (dx) => {
      const { session } = await ready();
      const before = await semantic(session);
      const changed = committed(await session.execute({ command: 'move', id: 'a', dx, dy: 0 }));
      const undo = committed(await session.execute({ command: 'undo' }));
      expect(await semantic(session)).toEqual(before);
      expect(undo.status.revision).toBe(changed.status.revision + 1);
    }),
  ));
it('PROP-02 redo restores recorded after semantics exactly', () =>
  PropertyRunner.checkAsync(
    'PROP-02',
    fc.asyncProperty(fc.integer({ min: 2, max: 10 }), async (factor) => {
      const { session } = await ready();
      await session.execute({ command: 'scale', id: 'a', factor });
      const after = await semantic(session);
      await session.execute({ command: 'undo' });
      committed(await session.execute({ command: 'redo' }));
      expect(await semantic(session)).toEqual(after);
    }),
  ));
it('PROP-03 actual dry-run is unchanged and wouldChange agrees with following commit', () =>
  PropertyRunner.checkAsync(
    'PROP-03',
    fc.asyncProperty(fc.integer({ min: 0, max: 4 }), async (choice) => {
      const { session } = await ready();
      const requests: EditRequest[] = [
        { command: 'move', id: 'a', dx: 1, dy: 0 },
        { command: 'group', newId: 'G', ids: ['b', 'a'] },
        { command: 'delete', id: 'a' },
        { command: 'create', shape: { type: 'text', id: 't', x: 1, y: 2, text: ' a  🙂\r\n' } },
        { command: 'scale', id: 'g', factor: 3 },
      ];
      const request = requests[choice]!;
      const before = await semantic(session);
      const status = (await session.execute({ command: 'tree' })).status;
      const dry = await session.execute(request, { mode: 'dry-run' });
      if (!dry.ok || dry.mode !== 'dry-run') throw new Error('dry-run failed');
      expect(dry.status).toEqual(status);
      expect(await semantic(session)).toEqual(before);
      const changed = committed(await session.execute(request));
      expect(changed.contentChanged).toBe(dry.wouldChange);
    }),
  ));
it('PROP-09 deliberate illegal commands really execute and ordinary failures preserve whole observable session', () =>
  PropertyRunner.checkAsync(
    'PROP-09',
    fc.asyncProperty(fc.integer({ min: 0, max: 4 }), async (choice) => {
      const { session } = await ready();
      await session.execute({ command: 'move', id: 'a', dx: 1, dy: 0 });
      await session.execute({ command: 'undo' });
      const before = await semantic(session);
      const status = (await session.execute({ command: 'tree' })).status;
      const requests: EditRequest[] = [
        { command: 'scale', id: 'g', factor: 0 },
        { command: 'group', newId: 'G', ids: ['a', 'a'] },
        { command: 'create', shape: { type: 'g', id: 'a' } },
        { command: 'move', id: 'missing', dx: 1, dy: 0 },
        { command: 'addto', containerId: 'g', id: 'g' },
      ];
      const failure = await session.execute(requests[choice]!);
      expect(failure.ok).toBe(false);
      if (!failure.ok) expect(failure.effect).toBe('unchanged');
      expect(failure.status).toEqual(status);
      expect(await semantic(session)).toEqual(before);
      committed(await session.execute({ command: 'redo' }));
    }),
  ));
it('PROP-10 valid no-op never clears Redo and barrier release is an independent session change', () =>
  PropertyRunner.checkAsync(
    'PROP-10',
    fc.asyncProperty(fc.integer({ min: 0, max: 3 }), async (choice) => {
      const { session } = await ready();
      await session.execute({ command: 'move', id: 'a', dx: 1, dy: 0 });
      const undo = committed(await session.execute({ command: 'undo' }));
      const requests: EditRequest[] = [
        { command: 'move', id: 'a', dx: 0, dy: 0 },
        { command: 'scale', id: 'g', factor: 2 },
        { command: 'front', id: 'b' },
        { command: 'back', id: 'g' },
      ];
      const result = committed(await session.execute(requests[choice]!));
      expect(result.status).toEqual(undo.status);
      expect(result.contentChanged).toBe(false);
      committed(await session.execute({ command: 'redo' }));
      const barrier = committed(
        await session.execute({ command: 'canvas', size: { width: 801, height: 600 } }),
      );
      const noOp = committed(await session.execute(requests[choice]!));
      expect(noOp.contentChanged).toBe(false);
      expect(noOp.sessionChanged).toBe(true);
      expect(noOp.status.revision).toBe(barrier.status.revision + 1);
    }),
  ));
it('PROP-13 independent leaf changes commute in semantic comparison', () =>
  PropertyRunner.checkAsync(
    'PROP-13',
    fc.asyncProperty(
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: 1, max: 20 }),
      async (dx, radius) => {
        const left = (await ready()).session;
        const right = (await ready()).session;
        const a: EditRequest = { command: 'move', id: 'a', dx, dy: 3 };
        const b: EditRequest = { command: 'set', id: 'b', attribute: 'r', value: radius };
        for (const request of [a, b]) committed(await left.execute(request));
        for (const request of [b, a]) committed(await right.execute(request));
        expect(await semantic(left)).toEqual(await semantic(right));
      },
    ),
  ));
