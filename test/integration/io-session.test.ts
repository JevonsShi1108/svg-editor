import { expect, it, describe, vi } from 'vitest';
import { ioFixture, explicitSvg, anonymousSvg } from '../helpers/io-session.js';
import { committed, semantic } from '../helpers/session.js';
import { ResultFactory } from '../../src/application/internal/ResultFactory.js';
import { HistoryManager } from '../../src/application/history/HistoryManager.js';
import { DomainError } from '../../src/domain/errors/DomainError.js';
import { SvgDocument } from '../../src/domain/document/SvgDocument.js';
import { accessDocument } from '../../src/domain/internal/storage.js';
import { TextPresenter } from '../../src/cli/TextPresenter.js';
import { CliRepl } from '../../src/cli/CliRepl.js';
import { CliParser } from '../../src/cli/CliParser.js';
import type { CommandRequest } from '../../src/application/contracts/api.js';
describe('M10 DOC/ID publication and current path', () => {
  it('DOC-03/06/07/08 ID-10/11 clean and repaired reads, save default path, init clears path', async () => {
    const { session, files } = ioFixture();
    const read = committed(await session.execute({ command: 'read', path: 'a.svg' }));
    expect(read.status).toEqual({
      state: 'ready',
      revision: 1,
      currentPath: '/memory/a.svg',
      dirty: false,
      history: { undoCount: 0, redoCount: 0, barrier: 'read' },
    });
    expect(read.warnings).toEqual([]);
    const repeated = committed(await session.execute({ command: 'read', path: 'a.svg' }));
    expect(repeated.status.revision).toBe(2);
    const cleanSave = committed(await session.execute({ command: 'save' }));
    expect(cleanSave.contentChanged).toBe(false);
    expect(cleanSave.sessionChanged).toBe(true);
    expect(cleanSave.status.revision).toBe(3);
    expect(cleanSave.status.history.barrier).toBe('save');
    expect(files.writeCalls[0]!.path).toBe('/memory/a.svg');
    const anonymous = committed(await session.execute({ command: 'read', path: 'anonymous.svg' }));
    expect(anonymous.status.dirty).toBe(true);
    expect(anonymous.warnings).toEqual([
      { code: 'ASSIGNED_ID', parameters: { id: 'rect1', type: 'rect' } },
    ]);
    const saved = committed(await session.execute({ command: 'save', path: '中文 drawing.svg' }));
    expect(saved.status.currentPath).toBe('/memory/中文 drawing.svg');
    expect(saved.status.dirty).toBe(false);
    await session.execute({ command: 'save' });
    expect(files.writeCalls.at(-1)!.path).toBe('/memory/中文 drawing.svg');
    await session.execute({ command: 'init' });
    const count = files.writeCalls.length;
    const noPath = await session.execute({ command: 'save' });
    expect(noPath.ok).toBe(false);
    if (!noPath.ok) expect(noPath.error.code).toBe('NO_SAVE_PATH');
    expect(files.writeCalls).toHaveLength(count);
    expect(noPath.status.currentPath).toBeNull();
  });
  it('IO-01 paths are opaque to Application, no shell expansion or attr length limit', async () => {
    const { session, files } = ioFixture();
    for (const name of ['space and 中文.svg', '~/$VAR/%VAR%.svg', 'a'.repeat(5000)]) {
      files.files.set(`/memory/${name}`, explicitSvg);
      const result = committed(await session.execute({ command: 'read', path: name }));
      expect(result.status.currentPath).toBe(`/memory/${name}`);
    }
    const status = (await session.execute({ command: 'tree' })).status;
    for (const path of ['', '\0']) {
      const failed = await session.execute({ command: 'read', path });
      expect(failed.ok).toBe(false);
      expect(failed.status).toEqual(status);
    }
  });
  for (const source of [
    'not XML',
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="1" height="1"/><circle r="-1"/></svg>',
  ])
    it(`IO-02/ID-06 bad read never publishes document or partial warning: ${source.slice(0, 10)}`, async () => {
      const { session, files } = ioFixture();
      await session.execute({ command: 'read', path: 'a.svg' });
      await session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 });
      const before = await semantic(session);
      const status = (await session.execute({ command: 'tree' })).status;
      files.files.set('/memory/bad.svg', source);
      const failed = await session.execute({ command: 'read', path: 'bad.svg' });
      expect(failed.ok).toBe(false);
      if (!failed.ok) expect(failed.effect).toBe('unchanged');
      expect(failed.status).toEqual(status);
      expect(await semantic(session)).toEqual(before);
      expect(new TextPresenter().render(failed).stderr).not.toContain('assigned id');
      committed(await session.execute({ command: 'undo' }));
    });
  it('IO-02 candidate result/invariant failures preserve trusted old or empty Head', async () => {
    const { session, codec } = ioFixture();
    for (const existing of [false, true]) {
      if (existing) await session.execute({ command: 'read', path: 'a.svg' });
      const status = (await session.execute({ command: 'help' })).status;
      const spy = vi.spyOn(codec, 'decode').mockImplementationOnce(() => {
        throw new DomainError('INTERNAL_INVARIANT_ERROR');
      });
      const failure = await session.execute({ command: 'read', path: 'a.svg' });
      spy.mockRestore();
      expect(failure.status).toEqual(status);
      if (!failure.ok) expect(failure.effect).toBe('unchanged');
    }
    const status = (await session.execute({ command: 'tree' })).status;
    const spy = vi.spyOn(ResultFactory, 'commit').mockImplementationOnce(() => {
      throw new Error('read result preparation');
    });
    const failure = await session.execute({ command: 'read', path: 'anonymous.svg' });
    spy.mockRestore();
    expect(failure.status).toEqual(status);
    expect(new TextPresenter().render(failure).stderr).not.toContain('assigned id');
  });
});
describe('M10 REG-SAVE / IO-03—10 three distinct outcomes', () => {
  for (const outcome of ['not-committed', 'committed', 'indeterminate'] as const)
    for (const physical of outcome === 'indeterminate' ? [false, true] : [false])
      it(`${outcome}, indeterminate physical changed=${physical}`, async () => {
        const { session, files, codec } = ioFixture();
        await session.execute({ command: 'read', path: 'a.svg' });
        await session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 });
        const before = await semantic(session);
        const status = (await session.execute({ command: 'tree' })).status;
        files.outcome = outcome;
        files.physicalIndeterminate = physical;
        const result = await session.execute({ command: 'save', path: 'b.svg' });
        expect(files.writeCalls).toHaveLength(1);
        expect(await semantic(session)).toEqual(before);
        if (outcome === 'committed') {
          const saved = committed(result);
          expect(saved.contentChanged).toBe(false);
          expect(saved.status).toEqual({
            ...status,
            currentPath: '/memory/b.svg',
            dirty: false,
            revision: status.revision + 1,
            history: { undoCount: 0, redoCount: 0, barrier: 'save' },
          });
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
        } else {
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.effect).toBe(
              outcome === 'not-committed' ? 'unchanged' : 'external-unknown',
            );
            expect(result.error.code).toBe(
              outcome === 'not-committed' ? 'FILE_IO_ERROR' : 'SAVE_OUTCOME_UNKNOWN',
            );
          }
          expect(result.status).toEqual(status);
          if (outcome === 'not-committed') expect(files.files.get('/memory/b.svg')).toBe('OLD');
          committed(await session.execute({ command: 'undo' }));
        }
      });
  for (const point of ['encode', 'history', 'result'])
    it(`IO-03/04 ${point} preparation failure leaves target OLD, zero replace calls and metadata unchanged`, async () => {
      const { session, files, codec } = ioFixture();
      await session.execute({ command: 'read', path: 'a.svg' });
      await session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 });
      const before = await semantic(session);
      const status = (await session.execute({ command: 'tree' })).status;
      const fail = () => {
        throw new Error('preparation stopped');
      };
      const spy =
        point === 'encode'
          ? vi.spyOn(codec, 'encode').mockImplementationOnce(fail)
          : point === 'history'
            ? vi.spyOn(HistoryManager.prototype, 'afterBarrier').mockImplementationOnce(fail)
            : vi.spyOn(ResultFactory, 'commit').mockImplementationOnce(fail);
      const failed = await session.execute({ command: 'save', path: 'b.svg' });
      spy.mockRestore();
      expect(failed.ok).toBe(false);
      expect(failed.status).toEqual(status);
      expect(files.writeCalls).toHaveLength(0);
      expect(files.files.get('/memory/b.svg')).toBe('OLD');
      expect(await semantic(session)).toEqual(before);
      committed(await session.execute({ command: 'save', path: 'b.svg' }));
    });
  it('IO-07 thrown replacement result is external-unknown even if physical NEW committed', async () => {
    const { session, files } = ioFixture();
    await session.execute({ command: 'read', path: 'a.svg' });
    const status = (await session.execute({ command: 'tree' })).status;
    files.throwAfterWrite = true;
    const result = await session.execute({ command: 'save', path: 'b.svg' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.effect).toBe('external-unknown');
    expect(result.status).toEqual(status);
    expect(files.writeCalls).toHaveLength(1);
  });
  it('IO-08/CLI-14 committed stdout failure neither rolls back nor re-executes; API remains usable', async () => {
    const { session, files, catalog } = ioFixture();
    await session.execute({ command: 'read', path: 'a.svg' });
    await session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 });
    const revision = (await session.execute({ command: 'tree' })).status.revision;
    async function* input() {
      yield 'save b.svg';
      yield 'move r1 99 99';
    }
    await expect(
      new CliRepl(session, new CliParser(catalog)).run(input(), {
        interactive: false,
        stdout: async () => {
          throw new Error('stdout failed');
        },
        stderr: async () => {},
      }),
    ).rejects.toThrow('stdout failed');
    expect(files.writeCalls).toHaveLength(1);
    const status = (await session.execute({ command: 'tree' })).status;
    expect(status).toMatchObject({
      dirty: false,
      currentPath: '/memory/b.svg',
      revision: revision + 1,
      history: { barrier: 'save' },
    });
    const noOp = committed(await session.execute({ command: 'move', id: 'r1', dx: 0, dy: 0 }));
    expect(noOp.contentChanged).toBe(false);
    expect(noOp.sessionChanged).toBe(true);
    expect(noOp.status.dirty).toBe(false);
  });
  it('IO-10 external file modifications do not recompute saved content identity', async () => {
    const { session, files } = ioFixture();
    await session.execute({ command: 'read', path: 'a.svg' });
    const status = (await session.execute({ command: 'tree' })).status;
    files.files.set('/memory/a.svg', 'EXTERNAL');
    expect((await session.execute({ command: 'tree' })).status).toEqual(status);
    expect(status.dirty).toBe(false);
  });
});
it('REG-STATE exact 15-step saved-content trace including no-op, failure, dry-run and canvas same-size', async () => {
  const { session } = ioFixture();
  const table: {
    request: CommandRequest;
    mode?: 'dry-run';
    revision: number;
    undo: number;
    redo: number;
    barrier: string | null;
    dirty: boolean;
  }[] = [
    {
      request: { command: 'read', path: 'a.svg' },
      revision: 1,
      undo: 0,
      redo: 0,
      barrier: 'read',
      dirty: false,
    },
    {
      request: { command: 'move', id: 'r1', dx: 1, dy: 0 },
      revision: 2,
      undo: 1,
      redo: 0,
      barrier: null,
      dirty: true,
    },
    { request: { command: 'undo' }, revision: 3, undo: 0, redo: 1, barrier: null, dirty: false },
    {
      request: { command: 'move', id: 'r1', dx: 0, dy: 0 },
      revision: 3,
      undo: 0,
      redo: 1,
      barrier: null,
      dirty: false,
    },
    {
      request: { command: 'scale', id: 'r1', factor: 0 },
      revision: 3,
      undo: 0,
      redo: 1,
      barrier: null,
      dirty: false,
    },
    {
      request: { command: 'move', id: 'r1', dx: 2, dy: 0 },
      mode: 'dry-run',
      revision: 3,
      undo: 0,
      redo: 1,
      barrier: null,
      dirty: false,
    },
    { request: { command: 'redo' }, revision: 4, undo: 1, redo: 0, barrier: null, dirty: true },
    {
      request: { command: 'save', path: 'b.svg' },
      revision: 5,
      undo: 0,
      redo: 0,
      barrier: 'save',
      dirty: false,
    },
    {
      request: { command: 'canvas', size: { width: 400, height: 300 } },
      revision: 5,
      undo: 0,
      redo: 0,
      barrier: 'save',
      dirty: false,
    },
    {
      request: { command: 'move', id: 'r1', dx: 0, dy: 0 },
      revision: 6,
      undo: 0,
      redo: 0,
      barrier: null,
      dirty: false,
    },
    { request: { command: 'undo' }, revision: 6, undo: 0, redo: 0, barrier: null, dirty: false },
    {
      request: { command: 'move', id: 'r1', dx: 1, dy: 0 },
      revision: 7,
      undo: 1,
      redo: 0,
      barrier: null,
      dirty: true,
    },
    {
      request: { command: 'move', id: 'r1', dx: -1, dy: 0 },
      revision: 8,
      undo: 2,
      redo: 0,
      barrier: null,
      dirty: true,
    },
    { request: { command: 'undo' }, revision: 9, undo: 1, redo: 1, barrier: null, dirty: true },
    { request: { command: 'undo' }, revision: 10, undo: 0, redo: 2, barrier: null, dirty: false },
  ];
  for (const [i, row] of table.entries()) {
    const result = await session.execute(row.request, row.mode ? { mode: row.mode } : undefined);
    expect(result.status.revision, `step ${i + 1}`).toBe(row.revision);
    expect(result.status.history, `step ${i + 1}`).toEqual({
      undoCount: row.undo,
      redoCount: row.redo,
      barrier: row.barrier,
    });
    expect(result.status.dirty, `step ${i + 1}`).toBe(row.dirty);
    expect(result.status.currentPath).toBe(i < 7 ? '/memory/a.svg' : '/memory/b.svg');
    if (i === 4 || i === 10) expect(result.ok).toBe(false);
    else expect(result.ok).toBe(true);
  }
});
for (const repaired of [false, true])
  it(`FAULT-01/05/06 read recovery and failed candidate keep fault diagnostics, repaired=${repaired}`, async () => {
    const { session, files, codec } = ioFixture();
    await session.execute({ command: 'read', path: 'a.svg' });
    const original = SvgDocument.prototype.beginEdit;
    const capture: { doc?: SvgDocument } = {};
    const grab = vi.spyOn(SvgDocument.prototype, 'beginEdit').mockImplementation(function (
      this: SvgDocument,
    ) {
      capture.doc = this;
      return original.call(this);
    });
    await session.execute({ command: 'move', id: 'r1', dx: 0, dy: 0 });
    grab.mockRestore();
    const access = accessDocument(capture.doc!);
    const write = access.writeState;
    const spy = vi.spyOn(access, 'writeState').mockImplementationOnce((authority, target, next) => {
      write(authority, target, next);
      throw new Error('partial');
    });
    const fault = await session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 });
    spy.mockRestore();
    expect(fault.status.state).toBe('poisoned');
    const encode = vi.spyOn(codec, 'encode');
    const saves = files.writeCalls.length;
    const rejected = await session.execute({ command: 'save', path: 'b.svg' });
    expect(rejected.ok).toBe(false);
    expect(encode).not.toHaveBeenCalled();
    expect(files.writeCalls).toHaveLength(saves);
    encode.mockRestore();
    files.files.set('/memory/bad.svg', 'bad');
    expect((await session.execute({ command: 'read', path: 'bad.svg' })).status).toEqual(
      fault.status,
    );
    files.files.set('/memory/recover.svg', repaired ? anonymousSvg : explicitSvg);
    const recovered = committed(await session.execute({ command: 'read', path: 'recover.svg' }));
    expect(recovered.status.state).toBe('ready');
    expect(recovered.status.dirty).toBe(repaired);
    expect(recovered.status.revision).toBe(fault.status.revision + 1);
    expect(recovered.status.history).toEqual({ undoCount: 0, redoCount: 0, barrier: 'read' });
    expect((await semantic(session)).children).toHaveLength(1);
  });
