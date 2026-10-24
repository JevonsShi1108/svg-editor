import { expect, it } from 'vitest';
import { ioFixture, explicitSvg } from '../helpers/io-session.js';
import { Deferred } from '../helpers/Deferred.js';
import { committed, semantic } from '../helpers/session.js';
import { CliRepl } from '../../src/cli/CliRepl.js';
import { CliParser } from '../../src/cli/CliParser.js';
it('QUEUE-01/06 save blocks later edit/query; snapshot status and saved content reflect precise prior state', async () => {
  const { session, files, codec } = ioFixture();
  await session.execute({ command: 'read', path: 'a.svg' });
  const preceding = session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 });
  files.writeGate = new Deferred<void>();
  const completed: string[] = [];
  const save = session.execute({ command: 'save', path: 'b.svg' }).then((r) => {
    completed.push('save');
    return r;
  });
  const query = session.execute({ command: 'tree' }).then((r) => {
    completed.push('query');
    return r;
  });
  const edit = session.execute({ command: 'move', id: 'r1', dx: 2, dy: 0 }).then((r) => {
    completed.push('edit');
    return r;
  });
  await files.writeStarted.promise;
  expect(completed).toEqual([]);
  expect(files.writeCalls).toHaveLength(1);
  expect(files.files.get('/memory/b.svg')).toBe('OLD');
  files.writeGate.resolve(undefined);
  const results = await Promise.all([preceding, save, query, edit]);
  expect(completed).toEqual(['save', 'query', 'edit']);
  expect(results.map((r) => r.status.revision)).toEqual([2, 3, 3, 4]);
  const saved = committed(results[1]!);
  expect(saved.status.dirty).toBe(false);
  expect(saved.status.history.barrier).toBe('save');
  expect(results[3]!.status.dirty).toBe(true);
  expect(
    codec
      .decode(files.files.get('/memory/b.svg')!, {
        maxSvgBytes: 10485760,
        maxNodeCount: 10000,
        maxTreeDepth: 64,
        maxTextLength: 100000,
        maxAttributeLength: 4096,
      })
      .document.require('r1')
      .describe().attributes,
  ).toContainEqual({ name: 'x', value: 11 });
  expect((await semantic(session)).children[0]!.shape.attributes).toContainEqual({
    name: 'x',
    value: 13,
  });
  expect(saved.status.history.barrier).toBe('save');
});
it('QUEUE-02 read blocks every following category and publishes candidate only before queued operations execute', async () => {
  const { session, files } = ioFixture();
  files.readGate = new Deferred<void>();
  const completed: string[] = [];
  const read = session.execute({ command: 'read', path: 'a.svg' }).then((r) => {
    completed.push('read');
    return r;
  });
  const query = session.execute({ command: 'tree' }).then((r) => {
    completed.push('query');
    return r;
  });
  const edit = session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 }).then((r) => {
    completed.push('edit');
    return r;
  });
  const undo = session.execute({ command: 'undo' }).then((r) => {
    completed.push('undo');
    return r;
  });
  await files.readStarted.promise;
  expect(completed).toEqual([]);
  expect(files.writeCalls).toHaveLength(0);
  files.readGate.resolve(undefined);
  const results = await Promise.all([read, query, edit, undo]);
  expect(completed).toEqual(['read', 'query', 'edit', 'undo']);
  expect(results.map((r) => r.status.revision)).toEqual([1, 1, 2, 3]);
  expect(results.every((r) => r.ok)).toBe(true);
  expect(results[3]!.status.dirty).toBe(false);
});
for (const outcome of ['committed', 'not-committed', 'indeterminate'] as const)
  it(`QUEUE-07 ${outcome} releases queue from precisely new or old Head`, async () => {
    const { session, files } = ioFixture();
    await session.execute({ command: 'read', path: 'a.svg' });
    await session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 });
    files.outcome = outcome;
    files.writeGate = new Deferred<void>();
    const complete: string[] = [];
    const save = session.execute({ command: 'save', path: 'b.svg' }).then((r) => {
      complete.push('save');
      return r;
    });
    const next = session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 }).then((r) => {
      complete.push('next');
      return r;
    });
    await files.writeStarted.promise;
    expect(complete).toEqual([]);
    files.writeGate.resolve(undefined);
    const saved = await save;
    const edited = committed(await next);
    expect(complete).toEqual(['save', 'next']);
    expect(saved.status.currentPath).toBe(
      outcome === 'committed' ? '/memory/b.svg' : '/memory/a.svg',
    );
    expect(edited.status.revision).toBe(outcome === 'committed' ? 4 : 3);
    expect(edited.status.history.undoCount).toBe(outcome === 'committed' ? 1 : 2);
    expect(edited.status.dirty).toBe(true);
  });
it('QUEUE-04 caller path and ID arrays are copied at enqueue, before delayed binding', async () => {
  const { session, files } = ioFixture();
  files.files.set('/memory/two.svg', explicitSvg.replace('</svg>', '<circle id="c" r="1"/></svg>'));
  await session.execute({ command: 'read', path: 'two.svg' });
  files.writeGate = new Deferred<void>();
  const saveRequest = { command: 'save' as const, path: 'b.svg' };
  const save = session.execute(saveRequest);
  const groupRequest = { command: 'group' as const, newId: 'G', ids: ['c', 'r1'] };
  const group = session.execute(groupRequest);
  const tree = session.execute({ command: 'tree' });
  const readRequest = { command: 'read' as const, path: 'a.svg' };
  const read = session.execute(readRequest);
  saveRequest.path = 'should-not-use.svg';
  groupRequest.ids.splice(0, 2, 'missing');
  readRequest.path = 'missing.svg';
  await files.writeStarted.promise;
  expect(files.writeCalls[0]!.path).toBe('/memory/b.svg');
  files.writeGate.resolve(undefined);
  committed(await save);
  committed(await group);
  const grouped = committed(await tree);
  if (grouped.data.kind !== 'tree' || !grouped.data.document) throw new Error('tree');
  expect(grouped.data.document.children[0]!.children.map((n) => n.shape.id)).toEqual(['r1', 'c']);
  const readResult = committed(await read);
  expect(readResult.status.currentPath).toBe('/memory/a.svg');
  expect((await semantic(session)).children).toHaveLength(1);
});
it('QUEUE-03 delayed read failure does not leave rejected tail; later init and query still complete', async () => {
  const { session, files } = ioFixture();
  files.readGate = new Deferred<void>();
  const failure = session.execute({ command: 'read', path: 'missing.svg' });
  const after = session.execute({ command: 'init' });
  const tree = session.execute({ command: 'tree' });
  await files.readStarted.promise;
  files.readGate.resolve(undefined);
  expect((await failure).ok).toBe(false);
  expect((await after).ok).toBe(true);
  expect((await tree).ok).toBe(true);
});
it('DRY-08 read/save reject mode before touching ports, including saved-path operations', async () => {
  const { session, files } = ioFixture();
  await session.execute({ command: 'read', path: 'a.svg' });
  const status = (await session.execute({ command: 'tree' })).status;
  const calls = [files.resolveCalls.length, files.readCalls.length, files.writeCalls.length];
  for (const request of [
    { command: 'read', path: 'anonymous.svg' },
    { command: 'save', path: 'b.svg' },
    { command: 'save' },
  ] as const) {
    const failed = await session.execute(request, { mode: 'dry-run' });
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe('UNSUPPORTED_MODE');
    expect(failed.status).toEqual(status);
  }
  expect([files.resolveCalls.length, files.readCalls.length, files.writeCalls.length]).toEqual(
    calls,
  );
});
it('DOC-09 illegal canvas with a real saved checkpoint and Redo preserves every field', async () => {
  const { session, codec } = ioFixture();
  await session.execute({ command: 'read', path: 'a.svg' });
  await session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 });
  const undo = committed(await session.execute({ command: 'undo' }));
  const before = await semantic(session);
  for (const width of [0, -1, NaN, Infinity]) {
    const failed = await session.execute({ command: 'canvas', size: { width, height: 300 } });
    expect(failed.ok).toBe(false);
    expect(failed.status).toEqual(undo.status);
    expect(await semantic(session)).toEqual(before);
    expect(codec.encode(await semantic(session))).toContain('viewBox="0 0 400 300"');
  }
  committed(await session.execute({ command: 'redo' }));
});
it('M10 REPL normal EOF waits for final async save before completing', async () => {
  const { session, files, catalog } = ioFixture();
  await session.execute({ command: 'read', path: 'a.svg' });
  files.writeGate = new Deferred<void>();
  let finished = false;
  async function* input() {
    yield 'save b.svg';
  }
  const running = new CliRepl(session, new CliParser(catalog))
    .run(input(), { interactive: false, stdout: async () => {}, stderr: async () => {} })
    .then((code) => {
      finished = true;
      return code;
    });
  await files.writeStarted.promise;
  expect(finished).toBe(false);
  expect(files.files.get('/memory/b.svg')).toBe('OLD');
  files.writeGate.resolve(undefined);
  expect(await running).toBe(0);
  expect(files.files.get('/memory/b.svg')).toContain('<rect id="r1"');
});
