import { expect, it, describe } from 'vitest';
import { sessionFixture, committed, semantic } from '../helpers/session.js';
import type { CommandRequest, EditRequest } from '../../src/application/contracts/api.js';
import { shapes, setFields, moved, scaled } from '../fixtures/shapes.js';
const ready = async () => {
  const h = sessionFixture();
  for (const request of [
    { command: 'init' },
    { command: 'create', shape: { type: 'g', id: 'P' } },
    { command: 'create', shape: { type: 'g', id: 'g' }, parentId: 'P' },
    { command: 'create', shape: { type: 'rect', id: 'r', x: 0.1, y: 20, width: 30, height: 40 } },
    { command: 'create', shape: { type: 'circle', id: 'c', cx: 12, cy: 18, r: 5 } },
  ] as CommandRequest[])
    committed(await h.session.execute(request));
  return h;
};
const edits: readonly EditRequest[] = [
  { command: 'create', shape: { type: 'ellipse', id: 'new', cx: 0, cy: 0, rx: 1, ry: 2 } },
  { command: 'move', id: 'r', dx: 5, dy: -3 },
  { command: 'scale', id: 'r', factor: 3 },
  { command: 'set', id: 'r', attribute: 'fill', value: 'red' },
  { command: 'delete', id: 'r' },
  { command: 'group', newId: 'G', ids: ['c', 'r'] },
  { command: 'ungroup', id: 'g' },
  { command: 'addto', containerId: 'g', id: 'r' },
  { command: 'front', id: 'r' },
  { command: 'back', id: 'r' },
];
describe('M07 every edit uses same dry-run and original replay path', () => {
  for (const [i, shape] of shapes.entries())
    for (const parentId of [undefined, 'P'])
      it(`CRT-01/GEO-01/02 API ${shape.type} ${parentId ?? 'root'} hand calculated`, async () => {
        const { session } = sessionFixture();
        await session.execute({ command: 'init' });
        await session.execute({ command: 'create', shape: { type: 'g', id: 'P' } });
        const request: EditRequest = {
          command: 'create',
          shape: { ...shape, id: 'node' },
          ...(parentId ? { parentId } : {}),
        };
        committed(await session.execute(request));
        const show = committed(await session.execute({ command: 'show', id: 'node' }));
        if (show.data.kind !== 'show') throw new Error('show');
        expect(show.data.parent).toEqual(
          parentId ? { kind: 'group', id: parentId } : { kind: 'root' },
        );
        await session.execute({ command: 'move', id: 'node', dx: 5, dy: -3 });
        let transformed = committed(await session.execute({ command: 'show', id: 'node' }));
        if (transformed.data.kind !== 'show') throw new Error('show');
        expect(
          Object.fromEntries(transformed.data.shape.attributes.map((a) => [a.name, a.value])),
        ).toEqual(moved[i]);
        if (shape.type !== 'g') await session.execute({ command: 'undo' });
        await session.execute({ command: 'scale', id: 'node', factor: 2 });
        transformed = committed(await session.execute({ command: 'show', id: 'node' }));
        if (transformed.data.kind !== 'show') throw new Error('show');
        expect(
          Object.fromEntries(transformed.data.shape.attributes.map((a) => [a.name, a.value])),
        ).toEqual(scaled[i]);
      });
  it('DRY-08 all currently registered non-edit modes reject without touching status or ports', async () => {
    const { session, ports } = await ready();
    const status = (await session.execute({ command: 'tree' })).status;
    for (const request of [
      { command: 'init' },
      { command: 'canvas' },
      { command: 'tree' },
      { command: 'show', id: 'r' },
      { command: 'help' },
      { command: 'undo' },
      { command: 'redo' },
    ] as CommandRequest[]) {
      const failed = await session.execute(request, { mode: 'dry-run' });
      expect(failed.ok).toBe(false);
      if (!failed.ok) expect(failed.error.code).toBe('UNSUPPORTED_MODE');
      expect(failed.status).toEqual(status);
    }
    expect(ports.calls).toEqual([]);
  });
  it('SET-04/05 explicit black differs from absence, canonical paint no-op retains Redo', async () => {
    const { session } = await ready();
    const before = await semantic(session);
    const set = committed(
      await session.execute({ command: 'set', id: 'r', attribute: 'fill', value: 'BLACK' }),
    );
    expect(set.contentChanged).toBe(true);
    const after = await semantic(session);
    expect(after.children.find((n) => n.shape.id === 'r')!.shape.attributes).toContainEqual({
      name: 'fill',
      value: 'black',
    });
    await session.execute({ command: 'undo' });
    expect(await semantic(session)).toEqual(before);
    await session.execute({ command: 'redo' });
    expect(await semantic(session)).toEqual(after);
    await session.execute({ command: 'move', id: 'r', dx: 1, dy: 0 });
    const undone = committed(await session.execute({ command: 'undo' }));
    const noOp = committed(
      await session.execute({ command: 'set', id: 'r', attribute: 'fill', value: 'black' }),
    );
    expect(noOp.contentChanged).toBe(false);
    expect(noOp.status).toEqual(undone.status);
    committed(await session.execute({ command: 'redo' }));
  });
  for (const request of edits)
    it(`HIS-01 / DRY-01/06/07 ${request.command}`, async () => {
      const { session } = await ready();
      const observed = committed(await session.execute({ command: 'tree' }));
      const before = await semantic(session);
      const dry = await session.execute(request, { mode: 'dry-run' });
      expect(dry.ok).toBe(true);
      if (!dry.ok || dry.mode !== 'dry-run') throw new Error('dry-run expected');
      expect(dry.wouldChange).toBe(true);
      expect(dry.status).toEqual(observed.status);
      expect(await semantic(session)).toEqual(before);
      const preview = structuredClone(dry.preview);
      expect(Reflect.set(dry.preview, '0', {})).toBe(false);
      const changed = committed(await session.execute(request));
      expect(changed.contentChanged).toBe(true);
      expect(changed.status.history.undoCount).toBe(observed.status.history.undoCount + 1);
      expect(changed.status.revision).toBe(observed.status.revision + 1);
      const after = await semantic(session);
      expect(dry.preview).toEqual(preview);
      const undo = committed(await session.execute({ command: 'undo' }));
      expect(undo.status.revision).toBe(changed.status.revision + 1);
      expect(await semantic(session)).toEqual(before);
      committed(await session.execute({ command: 'redo' }));
      expect(await semantic(session)).toEqual(after);
    });
  for (const request of [
    { command: 'move', id: 'r', dx: 0, dy: 0 },
    { command: 'scale', id: 'r', factor: 1 },
    { command: 'move', id: 'g', dx: 5, dy: -3 },
    { command: 'scale', id: 'g', factor: 2 },
    { command: 'set', id: 'r', attribute: 'width', value: 30 },
    { command: 'front', id: 'c' },
    { command: 'back', id: 'P' },
    { command: 'addto', containerId: 'P', id: 'g' },
  ] as EditRequest[])
    it(`DRY-02/03 HIS-04/07 no-op ${JSON.stringify(request)}`, async () => {
      const { session } = await ready();
      await session.execute({ command: 'move', id: 'r', dx: 1, dy: 0 });
      const undone = committed(await session.execute({ command: 'undo' }));
      const before = await semantic(session);
      const dry = await session.execute(request, { mode: 'dry-run' });
      if (!dry.ok || dry.mode !== 'dry-run') throw new Error('Expected dry-run');
      expect(dry.wouldChange).toBe(false);
      expect(dry.status).toEqual(undone.status);
      const noop = committed(await session.execute(request));
      expect(noop.contentChanged).toBe(false);
      expect(noop.sessionChanged).toBe(false);
      expect(noop.status).toEqual(undone.status);
      expect(await semantic(session)).toEqual(before);
      committed(await session.execute({ command: 'redo' }));
      const canvas = committed(
        await session.execute({ command: 'canvas', size: { width: 801, height: 600 } }),
      );
      const atBarrier = await session.execute(request, { mode: 'dry-run' });
      expect(atBarrier.status).toEqual(canvas.status);
      const unblocked = committed(await session.execute(request));
      expect(unblocked.contentChanged).toBe(false);
      expect(unblocked.sessionChanged).toBe(true);
      expect(unblocked.status.revision).toBe(canvas.status.revision + 1);
      expect(unblocked.status.history).toEqual({ undoCount: 0, redoCount: 0, barrier: null });
      const empty = await session.execute({ command: 'undo' });
      if (empty.ok) throw new Error('Expected empty history');
      expect(empty.error.code).toBe('NOTHING_TO_UNDO');
    });
  it('DRY-04 create/group/delete preserve original Redo; DRY-05 invalid request identical effects', async () => {
    for (const request of [edits[0]!, edits[4]!, edits[5]!]) {
      const { session } = await ready();
      await session.execute({ command: 'move', id: 'r', dx: 1, dy: 0 });
      const undo = committed(await session.execute({ command: 'undo' }));
      expect((await session.execute(request, { mode: 'dry-run' })).status).toEqual(undo.status);
      committed(await session.execute({ command: 'redo' }));
    }
    const { session } = await ready();
    const before = committed(await session.execute({ command: 'tree' }));
    const invalid: EditRequest = { command: 'group', newId: 'bad', ids: ['P', 'g'] };
    const dry = await session.execute(invalid, { mode: 'dry-run' });
    const actual = await session.execute(invalid);
    expect(dry).toEqual(actual);
    expect(dry.status).toEqual(before.status);
  });
  it('DOC-04/05/09 TX-10 canvas only changes root, exact no-op preserves barrier/Redo, invalid input unchanged', async () => {
    const { session } = await ready();
    await session.execute({ command: 'move', id: 'r', dx: 1, dy: 0 });
    const undo = committed(await session.execute({ command: 'undo' }));
    const before = await semantic(session);
    expect((await session.execute({ command: 'canvas' })).status).toEqual(undo.status);
    const same = committed(
      await session.execute({ command: 'canvas', size: { width: 800, height: 600 } }),
    );
    expect(same.status).toEqual(undo.status);
    for (const width of [0, -1, NaN, Infinity]) {
      const fail = await session.execute({ command: 'canvas', size: { width, height: 600 } });
      expect(fail.ok).toBe(false);
      expect(fail.status).toEqual(undo.status);
      expect(await semantic(session)).toEqual(before);
    }
    const changed = committed(
      await session.execute({ command: 'canvas', size: { width: 400, height: 300 } }),
    );
    expect(changed.status.history).toEqual({ undoCount: 0, redoCount: 0, barrier: 'canvas' });
    expect(changed.contentChanged).toBe(true);
    expect(changed.sessionChanged).toBe(true);
    expect((await semantic(session)).children).toEqual(before.children);
    expect((await semantic(session)).size).toEqual({ width: 400, height: 300 });
    expect(
      (await session.execute({ command: 'canvas', size: { width: 400, height: 300 } })).status,
    ).toEqual(changed.status);
  });
  it('GEO-07 failed composite overflow preserves Redo and full state', async () => {
    const { session } = sessionFixture();
    for (const request of [
      { command: 'init' },
      { command: 'create', shape: { type: 'g', id: 'G' } },
      {
        command: 'create',
        shape: { type: 'rect', id: 'a', x: 0.1, y: 0, width: 1, height: 1 },
        parentId: 'G',
      },
      {
        command: 'create',
        shape: { type: 'circle', id: 'b', cx: 1e308, cy: 0, r: 1 },
        parentId: 'G',
      },
      { command: 'move', id: 'a', dx: 1, dy: 0 },
      { command: 'undo' },
    ] as CommandRequest[])
      committed(await session.execute(request));
    const before = await semantic(session);
    const status = (await session.execute({ command: 'tree' })).status;
    const failed = await session.execute({ command: 'scale', id: 'G', factor: 2 });
    expect(failed.ok).toBe(false);
    expect(failed.status).toEqual(status);
    expect(await semantic(session)).toEqual(before);
    committed(await session.execute({ command: 'redo' }));
  });
  it('HIS-09/QUEUE-05 all requests parse IDs when executing, not when enqueued', async () => {
    const { session } = await ready();
    const old = await semantic(session);
    await session.execute({ command: 'delete', id: 'r' });
    await session.execute({
      command: 'create',
      shape: { type: 'circle', id: 'r', cx: 5, cy: 6, r: 7 },
    });
    await session.execute({ command: 'undo' });
    await session.execute({ command: 'undo' });
    expect(await semantic(session)).toEqual(old);
    await session.execute({ command: 'redo' });
    await session.execute({ command: 'redo' });
    let doc = await semantic(session);
    expect(doc.children.find((n) => n.shape.id === 'r')!.shape.type).toBe('circle');
    const pending = [
      session.execute({ command: 'delete', id: 'r' }),
      session.execute({
        command: 'create',
        shape: { type: 'text', id: 'r', x: 7, y: 8, text: 'new' },
      }),
      session.execute({ command: 'move', id: 'r', dx: 2, dy: 3 }),
    ];
    expect((await Promise.all(pending)).every((r) => r.ok)).toBe(true);
    doc = await semantic(session);
    const node = doc.children.find((n) => n.shape.id === 'r')!.shape;
    expect(node.type).toBe('text');
    expect(node.attributes).toContainEqual({ name: 'x', value: 9 });
  });
  for (const [i, shape] of shapes.entries())
    for (const attribute of ['fill', 'stroke', 'stroke-width', ...setFields[i]!])
      it(`SET-01 Session full ${shape.type}.${attribute}`, async () => {
        const { session } = sessionFixture();
        await session.execute({ command: 'init' });
        await session.execute({ command: 'create', shape });
        const before = await semantic(session);
        const value =
          attribute === 'text'
            ? '  中文🙂 &<> '
            : attribute === 'fill' || attribute === 'stroke'
              ? 'red'
              : 77;
        const set = committed(
          await session.execute({ command: 'set', id: shape.id, attribute, value }),
        );
        expect(set.status.history.undoCount).toBe(2);
        const after = await semantic(session);
        await session.execute({ command: 'undo' });
        expect(await semantic(session)).toEqual(before);
        await session.execute({ command: 'redo' });
        expect(await semantic(session)).toEqual(after);
      });
});
