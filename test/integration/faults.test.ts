import { expect, it, vi } from 'vitest';
import { sessionFixture, committed, semantic } from '../helpers/session.js';
import { SvgDocument } from '../../src/domain/document/SvgDocument.js';
import { accessDocument } from '../../src/domain/internal/storage.js';
import { ResultFactory } from '../../src/application/internal/ResultFactory.js';
import { HistoryManager } from '../../src/application/history/HistoryManager.js';
import { DomainError } from '../../src/domain/errors/DomainError.js';
import type { CommandRequest } from '../../src/application/contracts/api.js';
const fixture = async () => {
  const h = sessionFixture();
  await h.session.execute({ command: 'init' });
  const captured: { document?: SvgDocument } = {};
  const original = SvgDocument.prototype.beginEdit;
  const capture = vi.spyOn(SvgDocument.prototype, 'beginEdit').mockImplementation(function (
    this: SvgDocument,
  ) {
    captured.document = this;
    return original.call(this);
  });
  for (const request of [
    { command: 'create', shape: { type: 'g', id: 'P' } },
    {
      command: 'create',
      shape: { type: 'rect', id: 'a', x: 1, y: 0, width: 1, height: 1 },
      parentId: 'P',
    },
    { command: 'create', shape: { type: 'rect', id: 'b', x: 2, y: 0, width: 1, height: 1 } },
  ] as CommandRequest[])
    committed(await h.session.execute(request));
  capture.mockRestore();
  if (!captured.document) throw new Error('internal test capture failed');
  return { ...h, document: captured.document };
};
it('TX-10 canvas prepared result failure restores root and all metadata, then remains usable', async () => {
  const { session } = await fixture();
  const before = await semantic(session);
  const status = (await session.execute({ command: 'tree' })).status;
  const spy = vi.spyOn(ResultFactory, 'commit').mockImplementationOnce(() => {
    throw new Error('canvas result preparation');
  });
  const failure = await session.execute({ command: 'canvas', size: { width: 100, height: 200 } });
  spy.mockRestore();
  expect(failure.ok).toBe(false);
  expect(failure.status).toEqual(status);
  expect(await semantic(session)).toEqual(before);
  committed(await session.execute({ command: 'undo' }));
});
it('FAIL-06 preview preparation after prepare fails with unchanged and Redo retained', async () => {
  const { session } = await fixture();
  await session.execute({ command: 'move', id: 'a', dx: 1, dy: 0 });
  const status = (await session.execute({ command: 'undo' })).status;
  const before = await semantic(session);
  const spy = vi.spyOn(ResultFactory, 'preview').mockImplementationOnce(() => {
    throw new Error('preview preparation');
  });
  const failed = await session.execute(
    { command: 'move', id: 'a', dx: 2, dy: 0 },
    { mode: 'dry-run' },
  );
  spy.mockRestore();
  expect(failed.ok).toBe(false);
  if (!failed.ok) expect(failed.effect).toBe('unchanged');
  expect(failed.status).toEqual(status);
  expect(await semantic(session)).toEqual(before);
  committed(await session.execute({ command: 'redo' }));
});
for (const direction of ['undo', 'redo'] as const)
  for (const failId of ['a', 'b'])
    it(`FAIL-07/08 ${direction} stops at ${failId} and compensates actual replay direction`, async () => {
      const { session, document } = await fixture();
      await session.execute({ command: 'group', newId: 'G', ids: ['b', 'a'] });
      if (direction === 'redo') committed(await session.execute({ command: 'undo' }));
      const before = await semantic(session);
      const status = (await session.execute({ command: 'tree' })).status;
      const access = accessDocument(document);
      const validate = access.validatePlacement;
      let failedOnce = false;
      const spy = vi.spyOn(access, 'validatePlacement').mockImplementation((node, from, to) => {
        if (node.id === failId && !failedOnce) {
          failedOnce = true;
          throw new Error('replay stop');
        }
        validate(node, from, to);
      });
      const failed = await session.execute({ command: direction });
      spy.mockRestore();
      expect(failedOnce).toBe(true);
      expect(failed.ok).toBe(false);
      if (!failed.ok) expect(failed.effect).toBe('unchanged');
      expect(failed.status).toEqual(status);
      expect(await semantic(session)).toEqual(before);
      committed(await session.execute({ command: direction }));
    });
for (const fault of ['partial-write', 'compensation', 'history-mismatch'] as const)
  it(`FAIL-09/10/11 FAULT isolation, trusted diagnostic retention and new-document recovery: ${fault}`, async () => {
    const { session, document, ports } = await fixture();
    const before = (await session.execute({ command: 'tree' })).status;
    const access = accessDocument(document);
    let restore: () => void;
    if (fault === 'partial-write') {
      const write = access.writeState;
      const spy = vi
        .spyOn(access, 'writeState')
        .mockImplementationOnce((authority, target, next) => {
          write(authority, target, next);
          throw new Error('unknown partial write');
        });
      restore = () => spy.mockRestore();
    } else if (fault === 'compensation') {
      const validate = access.validateState;
      let abort = false;
      const spy = vi.spyOn(access, 'validateState').mockImplementation((target, expected, next) => {
        if (target === document.require('b')) {
          abort = true;
          throw new Error('abort before b');
        }
        if (abort) throw new Error('compensation stopped');
        validate(target, expected, next);
      });
      restore = () => spy.mockRestore();
    } else {
      const spy = vi.spyOn(HistoryManager.prototype, 'peekUndo').mockImplementationOnce(() => {
        throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'wrong state token' });
      });
      restore = () => spy.mockRestore();
    }
    const request: CommandRequest =
      fault === 'history-mismatch'
        ? { command: 'undo' }
        : fault === 'compensation'
          ? { command: 'move', id: 'all', dx: 1, dy: 0 }
          : { command: 'move', id: 'a', dx: 1, dy: 0 };
    // For compensation the same Composite must have two children. Group before installing a state-only failure.
    if (fault === 'compensation')
      committed(await session.execute({ command: 'group', newId: 'all', ids: ['a', 'b'] }));
    const trusted = (await session.execute({ command: 'help' })).status;
    const failed = await session.execute(request);
    restore();
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.effect).toBe('untrusted');
      expect(failed.error.code).toBe('INTERNAL_INVARIANT_ERROR');
    }
    expect(failed.status.state).toBe('poisoned');
    expect(failed.status.dirty).toBeNull();
    expect(failed.status.revision).toBe(trusted.revision + 1);
    expect(failed.status.history).toEqual(trusted.history);
    expect(failed.status.currentPath).toBe(before.currentPath);
    for (const blocked of [
      { command: 'tree' },
      { command: 'show', id: 'a' },
      { command: 'canvas' },
      { command: 'move', id: 'a', dx: 1, dy: 0 },
      { command: 'create', shape: { type: 'g', id: 'fresh' } },
      { command: 'delete', id: 'a' },
      { command: 'scale', id: 'a', factor: 1 },
      { command: 'set', id: 'a', attribute: 'x', value: 1 },
      { command: 'group', newId: 'fresh', ids: ['a', 'b'] },
      { command: 'ungroup', id: 'all' },
      { command: 'addto', containerId: 'all', id: 'a' },
      { command: 'front', id: 'a' },
      { command: 'back', id: 'a' },
      { command: 'save', path: 'blocked.svg' },
      { command: 'undo' },
      { command: 'redo' },
      { command: 'canvas', size: { width: 1, height: 1 } },
    ] as CommandRequest[]) {
      const result = await session.execute(blocked);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('SESSION_POISONED');
      expect(result.status).toEqual(failed.status);
    }
    expect((await session.execute({ command: 'help' })).ok).toBe(true);
    expect(
      (await session.execute({ command: 'init', size: { width: 0, height: 1 } })).status,
    ).toEqual(failed.status);
    const initFailure = vi.spyOn(ResultFactory, 'commit').mockImplementationOnce(() => {
      throw new Error('candidate result failure');
    });
    const recovery = await session.execute({ command: 'init' });
    initFailure.mockRestore();
    expect(recovery.ok).toBe(false);
    expect(recovery.status).toEqual(failed.status);
    const fresh = committed(await session.execute({ command: 'init' }));
    expect(fresh.status.state).toBe('ready');
    expect(fresh.status.revision).toBe(failed.status.revision + 1);
    expect(fresh.status.dirty).toBe(true);
    expect((await semantic(session)).children).toEqual([]);
    expect(ports.calls).toEqual([]);
  });
