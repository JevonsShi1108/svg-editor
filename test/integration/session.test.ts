import { expect, it, describe, vi } from 'vitest';
import { sessionFixture, committed, semantic } from '../helpers/session.js';
import { HistoryManager } from '../../src/application/history/HistoryManager.js';
import { ResultFactory } from '../../src/application/internal/ResultFactory.js';
import { TextPresenter } from '../../src/cli/TextPresenter.js';
import type { CommandRequest } from '../../src/application/contracts/api.js';
const creation = {
  command: 'create' as const,
  shape: { type: 'rect' as const, id: 'r', x: 10, y: 20, width: 30, height: 40 },
};
describe('M06 Session vertical slice — actual Command/Domain/History, only IO ports fake', () => {
  it('DOC-01/02 init publication, default, replacement, invalid dimensions fully unchanged', async () => {
    const { session, ports } = sessionFixture();
    let result = committed(await session.execute({ command: 'init' }));
    expect(result.status).toEqual({
      state: 'ready',
      revision: 1,
      currentPath: null,
      dirty: true,
      history: { undoCount: 0, redoCount: 0, barrier: 'init' },
    });
    expect((await semantic(session)).size).toEqual({ width: 800, height: 600 });
    for (const size of [
      { width: 0, height: 600 },
      { width: 1, height: NaN },
      { width: Infinity, height: 1 },
    ]) {
      const failure = await session.execute({ command: 'init', size });
      expect(failure.ok).toBe(false);
      expect(failure.status).toEqual(result.status);
    }
    await session.execute(creation);
    result = committed(await session.execute({ command: 'init', size: { width: 10, height: 20 } }));
    expect(result.status.revision).toBe(3);
    expect((await semantic(session)).children).toEqual([]);
    expect(result.status.history.barrier).toBe('init');
    expect(ports.calls).toEqual([]);
  });
  it('HIS-01/02/03/04 / flags/revision exact, query and failure preserve Redo', async () => {
    const { session } = sessionFixture();
    await session.execute({ command: 'init' });
    const created = committed(await session.execute(creation));
    expect(created.status.revision).toBe(2);
    expect(created.status.history).toEqual({ undoCount: 1, redoCount: 0, barrier: null });
    const before = await semantic(session);
    const moved = committed(await session.execute({ command: 'move', id: 'r', dx: 5, dy: -3 }));
    expect(moved.contentChanged).toBe(true);
    expect(moved.sessionChanged).toBe(true);
    const after = await semantic(session);
    expect(after.children[0]!.shape.attributes).toContainEqual({ name: 'x', value: 15 });
    const undo = committed(await session.execute({ command: 'undo' }));
    expect(undo.status.revision).toBe(4);
    expect(await semantic(session)).toEqual(before);
    expect(undo.status.history).toEqual({ undoCount: 1, redoCount: 1, barrier: null });
    for (const request of [
      { command: 'help' },
      { command: 'show', id: 'r' },
      { command: 'tree' },
    ] as CommandRequest[]) {
      const q = committed(await session.execute(request));
      expect(q.status).toEqual(undo.status);
      expect(q.contentChanged).toBe(false);
      expect(q.sessionChanged).toBe(false);
    }
    const noOp = committed(await session.execute({ command: 'move', id: 'r', dx: 0, dy: 0 }));
    expect(noOp.status).toEqual(undo.status);
    expect(noOp.contentChanged).toBe(false);
    expect(noOp.sessionChanged).toBe(false);
    const failed = await session.execute({ command: 'move', id: 'missing', dx: 1, dy: 1 });
    expect(failed.ok).toBe(false);
    expect(failed.status).toEqual(undo.status);
    const redo = committed(await session.execute({ command: 'redo' }));
    expect(redo.status.revision).toBe(5);
    expect(await semantic(session)).toEqual(after);
    await session.execute({ command: 'undo' });
    await session.execute({ command: 'move', id: 'r', dx: 2, dy: 0 });
    const blocked = await session.execute({ command: 'redo' });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.error.code).toBe('NOTHING_TO_REDO');
  });
  it('CLI-11/HIS-06/12/QRY-04 no document, barrier, empty history distinguished and help works', async () => {
    const { session, catalog } = sessionFixture();
    const presenter = new TextPresenter();
    expect(committed(await session.execute({ command: 'help' })).data.kind).toBe('help');
    expect(catalog.describe()).toHaveLength(19);
    for (const request of [
      creation,
      { command: 'tree' },
      { command: 'show', id: 'r' },
      { command: 'move', id: 'r', dx: 1, dy: 1 },
      { command: 'undo' },
      { command: 'redo' },
    ] as CommandRequest[]) {
      const error = await session.execute(request);
      expect(error.ok).toBe(false);
      if (!error.ok) {
        expect(error.error.code).toBe('NO_DOCUMENT');
        expect(presenter.render(error).stderr).toBe(
          "error: no document. use 'init' or 'read' first\n",
        );
      }
    }
    const init = committed(await session.execute({ command: 'init' }));
    await session.execute({ command: 'tree' });
    await session.execute({ command: 'help' });
    await session.execute({ command: 'show', id: 'none' });
    await session.execute(creation, { mode: 'dry-run' });
    const undo = await session.execute({ command: 'undo' });
    expect(undo.status).toEqual(init.status);
    if (!undo.ok)
      expect(presenter.render(undo).stderr).toBe('error: undo not allowed after io command\n');
  });
  it('QUEUE-03/04 snapshots caller nested shape/size immediately and resolves all tasks in order', async () => {
    const { session } = sessionFixture();
    const init = { command: 'init' as const, size: { width: 80, height: 60 } };
    const create = structuredClone(creation);
    const move = { command: 'move' as const, id: 'r', dx: 2, dy: 3 };
    const first = session.execute(init);
    const second = session.execute(create);
    const third = session.execute(move);
    const query = session.execute({ command: 'tree' });
    init.size.width = 900;
    create.shape.x = 700;
    move.dx = 800;
    const results = await Promise.all([first, second, third, query]);
    expect(results.map((r) => r.status.revision)).toEqual([1, 2, 3, 3]);
    const doc = await semantic(session);
    expect(doc.size.width).toBe(80);
    expect(doc.children[0]!.shape.attributes).toContainEqual({ name: 'x', value: 12 });
    const bad = session.execute({ command: 'bogus' } as unknown as CommandRequest);
    const next = session.execute({ command: 'move', id: 'r', dx: 1, dy: 0 });
    expect((await bad).ok).toBe(false);
    expect((await next).ok).toBe(true);
    expect(Object.keys(session)).toEqual([]);
    expect('getDocument' in session).toBe(false);
    expect('requireDocument' in session).toBe(false);
    expect('initialize' in session).toBe(false);
    expect('edit' in session).toBe(false);
  });
  for (const preparation of ['history', 'result'])
    it(`FAIL-04/05 ${preparation} preparation after tx.prepare rolls back; old history remains usable`, async () => {
      const { session } = sessionFixture();
      await session.execute({ command: 'init' });
      await session.execute(creation);
      await session.execute({ command: 'move', id: 'r', dx: 1, dy: 0 });
      const undone = committed(await session.execute({ command: 'undo' }));
      const before = await semantic(session);
      const spy =
        preparation === 'history'
          ? vi.spyOn(HistoryManager.prototype, 'afterEdit').mockImplementationOnce(() => {
              throw new Error('allocation failure after prepare');
            })
          : vi.spyOn(ResultFactory, 'commit').mockImplementationOnce(() => {
              throw new Error('DTO failure after prepare');
            });
      const failed = await session.execute({ command: 'move', id: 'r', dx: 2, dy: 0 });
      spy.mockRestore();
      expect(failed.ok).toBe(false);
      if (!failed.ok) expect(failed.effect).toBe('unchanged');
      expect(failed.status).toEqual(undone.status);
      expect(await semantic(session)).toEqual(before);
      expect((await session.execute({ command: 'redo' })).ok).toBe(true);
    });
  it('FAIL-01 binding rejects without effects; DTO values and independent sessions stay isolated', async () => {
    const { session, ports } = sessionFixture();
    const other = sessionFixture();
    const invalid = await session.execute({
      ...creation,
      shape: { ...creation.shape, x: null },
    } as unknown as CommandRequest);
    expect(invalid.status.state).toBe('empty');
    expect(ports.calls).toEqual([]);
    await session.execute({ command: 'init' });
    await session.execute(creation);
    const old = await semantic(session);
    const snapshot = structuredClone(old);
    expect(Reflect.set(old.children[0]!.shape, 'id', 'z')).toBe(false);
    await session.execute({ command: 'move', id: 'r', dx: 1, dy: 0 });
    expect(old).toEqual(snapshot);
    const otherTree = await other.session.execute({ command: 'tree' });
    expect(otherTree.status.state).toBe('empty');
  });
});
