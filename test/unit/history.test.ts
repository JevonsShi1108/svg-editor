import { it, expect, describe } from 'vitest';
import { HistoryEntry } from '../../src/application/history/HistoryEntry.js';
import { HistoryManager } from '../../src/application/history/HistoryManager.js';
import type { StateId } from '../../src/application/contracts/history.js';
import { buildTree } from '../fixtures/tree.js';
import { edit } from '../helpers/edit.js';
import { InvariantOracle } from '../helpers/InvariantOracle.js';
const state = () => Symbol() as StateId;
const fixture = () => {
  const doc = buildTree(['r']);
  const a = state();
  const b = state();
  const changes = edit(doc, (tx) => doc.require('r').move(tx, 1, 0));
  const e = new HistoryEntry(doc.documentId, a, b, changes, {
    operation: 'move',
    targetIds: ['r'],
  });
  return { doc, a, b, changes, e };
};
describe('M05 HIS-03/04/05/07/09/12/13 immutable history values', () => {
  it('old managers immutable, original entry moved, no-op preserves redo and only clears barrier', () => {
    const { doc, a, b, e } = fixture();
    const empty = HistoryManager.empty();
    const first = empty.afterEdit(e);
    expect(empty.inspect()).toEqual({ undoCount: 0, redoCount: 0, barrier: null });
    expect(first.peekUndo(doc.documentId, b)).toBe(e);
    const undone = first.afterUndo(e);
    expect(first.inspect().undoCount).toBe(1);
    expect(undone.peekRedo(doc.documentId, a)).toBe(e);
    expect(undone.afterEdit(null)).toBe(undone);
    expect(undone.afterEdit(null).peekRedo(doc.documentId, a)).toBe(e);
    const redone = undone.afterRedo(e);
    expect(redone.peekUndo(doc.documentId, b)).toBe(e);
    expect(undone.inspect().redoCount).toBe(1);
    for (const reason of ['init', 'read', 'save', 'canvas'] as const) {
      const barrier = first.afterBarrier(reason);
      expect(barrier.inspect()).toEqual({ undoCount: 0, redoCount: 0, barrier: reason });
      expect(() => barrier.peekUndo(doc.documentId, b)).toThrow('HISTORY_BLOCKED');
      const noOp = barrier.afterEdit(null);
      expect(noOp.inspect()).toEqual({ undoCount: 0, redoCount: 0, barrier: null });
      expect(() => noOp.peekUndo(doc.documentId, b)).toThrow('NOTHING_TO_UNDO');
      expect(barrier.inspect().barrier).toBe(reason);
    }
  });
  it('changed edit truncates redo and preserves exact before-state chain', () => {
    const { doc, a, b, e } = fixture();
    const s2 = state();
    const secondChanges = edit(doc, (tx) => doc.require('r').move(tx, 2, 0));
    const second = new HistoryEntry(doc.documentId, b, s2, secondChanges, {
      operation: 'move',
      targetIds: ['r'],
    });
    const h = HistoryManager.empty().afterEdit(e).afterEdit(second);
    const undo = h.afterUndo(second);
    expect(undo.peekRedo(doc.documentId, b)).toBe(second);
    const s3 = state();
    const alternate = new HistoryEntry(doc.documentId, b, s3, secondChanges, {
      operation: 'move',
      targetIds: ['r'],
    });
    const alternateHistory = undo.afterEdit(alternate);
    expect(alternateHistory.inspect()).toEqual({ undoCount: 2, redoCount: 0, barrier: null });
    expect(() => alternateHistory.peekRedo(doc.documentId, s3)).toThrow('NOTHING_TO_REDO');
    expect(alternateHistory.afterUndo(alternate).peekUndo(doc.documentId, b)).toBe(e);
    expect(e.beforeStateId).toBe(a);
  });
  it('document/state/entry identity mismatches are internal faults, no mutation', () => {
    const { doc, a, b, e, changes } = fixture();
    const h = HistoryManager.empty().afterEdit(e);
    const other = fixture();
    expect(() => h.peekUndo(other.doc.documentId, b)).toThrow('INTERNAL_INVARIANT_ERROR');
    expect(() => h.peekUndo(doc.documentId, a)).toThrow('INTERNAL_INVARIANT_ERROR');
    const copy = new HistoryEntry(doc.documentId, a, b, changes, {
      operation: 'move',
      targetIds: ['r'],
    });
    expect(() => h.afterUndo(copy)).toThrow('INTERNAL_INVARIANT_ERROR');
    expect(() => h.afterRedo(e)).toThrow('INTERNAL_INVARIANT_ERROR');
    expect(
      () =>
        new HistoryEntry(other.doc.documentId, a, b, changes, {
          operation: 'move',
          targetIds: ['r'],
        }),
    ).toThrow();
    expect(() => HistoryManager.empty().peekRedo(doc.documentId, b)).toThrow('NOTHING_TO_REDO');
    expect(h.peekUndo(doc.documentId, b)).toBe(e);
    expect(Object.isFrozen(e.description.targetIds)).toBe(true);
  });
  it('HIS-09 old rect and new circle with same SVG id retain original identity on two undo/redo', () => {
    const doc = buildTree(['r']);
    const old = doc.require('r');
    const owner = old.ownerDocumentId;
    const a = state();
    const b = state();
    const c = state();
    const deleted = edit(doc, (tx) => old.delete(tx));
    const deleteEntry = new HistoryEntry(doc.documentId, a, b, deleted, {
      operation: 'delete',
      targetIds: ['r'],
    });
    const created = edit(doc, (tx) =>
      doc.create(tx, { type: 'circle', id: 'r', cx: 7, cy: 8, r: 9 }),
    );
    const current = doc.require('r');
    expect(current).not.toBe(old);
    const createEntry = new HistoryEntry(doc.documentId, b, c, created, {
      operation: 'create',
      targetIds: ['r'],
    });
    let h = HistoryManager.empty().afterEdit(deleteEntry).afterEdit(createEntry);
    let token = c;
    for (const entry of [createEntry, deleteEntry]) {
      expect(h.peekUndo(doc.documentId, token)).toBe(entry);
      edit(doc, (tx) => entry.changes.replay(tx, 'backward'));
      h = h.afterUndo(entry);
      token = entry.beforeStateId;
      InvariantOracle.check(doc);
    }
    expect(doc.require('r')).toBe(old);
    expect(doc.require('r').describe().type).toBe('rect');
    expect(old.ownerDocumentId).toBe(owner);
    for (const entry of [deleteEntry, createEntry]) {
      expect(h.peekRedo(doc.documentId, token)).toBe(entry);
      edit(doc, (tx) => entry.changes.replay(tx, 'forward'));
      h = h.afterRedo(entry);
      token = entry.afterStateId;
      InvariantOracle.check(doc);
    }
    expect(doc.require('r')).toBe(current);
    expect(current.ownerDocumentId).toBe(owner);
    expect(doc.require('r').describe().type).toBe('circle');
  });
  it('PERF-06 O(1) stack heads support long history without changing old values', () => {
    const { doc, a, b, e, changes } = fixture();
    let h = HistoryManager.empty();
    const original = h;
    let token = a;
    let first: HistoryEntry | undefined;
    for (let i = 0; i < 10000; i++) {
      const next = state();
      const entry = new HistoryEntry(doc.documentId, token, next, changes, e.description);
      first ??= entry;
      h = h.afterEdit(entry);
      token = next;
    }
    expect(h.inspect().undoCount).toBe(10000);
    for (let i = 0; i < 10000; i++) {
      const entry = h.peekUndo(doc.documentId, token);
      h = h.afterUndo(entry);
      token = entry.beforeStateId;
    }
    expect(h.inspect()).toEqual({ undoCount: 0, redoCount: 10000, barrier: null });
    expect(h.peekRedo(doc.documentId, a)).toBe(first);
    expect(original.inspect().undoCount).toBe(0);
    expect(() => h.peekUndo(doc.documentId, b)).toThrow('NOTHING_TO_UNDO');
  });
});
