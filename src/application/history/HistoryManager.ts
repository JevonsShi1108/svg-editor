import type { DocumentId } from '../../domain/values/contracts.js';
import type { StateId, BarrierReason, HistoryStatus } from '../contracts/history.js';
import type { HistoryEntry } from './HistoryEntry.js';
import { HistoryStackNode } from './HistoryStackNode.js';
import { DomainError } from '../../domain/errors/DomainError.js';
export class HistoryManager {
  readonly #undo: HistoryStackNode | null;
  readonly #redo: HistoryStackNode | null;
  readonly #barrier: BarrierReason | null;
  private constructor(
    undo: HistoryStackNode | null = null,
    redo: HistoryStackNode | null = null,
    barrier: BarrierReason | null = null,
  ) {
    this.#undo = undo;
    this.#redo = redo;
    this.#barrier = barrier;
    Object.freeze(this);
  }
  static empty(): HistoryManager {
    return new HistoryManager();
  }
  inspect(): HistoryStatus {
    return Object.freeze({
      undoCount: this.#undo?.size ?? 0,
      redoCount: this.#redo?.size ?? 0,
      barrier: this.#barrier,
    });
  }
  peekUndo(documentId: DocumentId, currentStateId: StateId): HistoryEntry {
    return this.peek('undo', documentId, currentStateId);
  }
  peekRedo(documentId: DocumentId, currentStateId: StateId): HistoryEntry {
    return this.peek('redo', documentId, currentStateId);
  }
  private peek(
    direction: 'undo' | 'redo',
    documentId: DocumentId,
    currentStateId: StateId,
  ): HistoryEntry {
    if (this.#barrier) throw new DomainError('HISTORY_BLOCKED', { direction });
    const entry = (direction === 'undo' ? this.#undo : this.#redo)?.entry;
    if (!entry) throw new DomainError(direction === 'undo' ? 'NOTHING_TO_UNDO' : 'NOTHING_TO_REDO');
    if (
      entry.documentId !== documentId ||
      entry.changes.documentId !== documentId ||
      currentStateId !== (direction === 'undo' ? entry.afterStateId : entry.beforeStateId)
    )
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'history identity' });
    return entry;
  }
  afterEdit(entry: HistoryEntry | null): HistoryManager {
    if (!entry) return this.#barrier ? new HistoryManager(this.#undo, this.#redo) : this;
    const previous = this.#undo?.entry;
    const following = this.#redo?.entry;
    if (
      (previous &&
        (previous.documentId !== entry.documentId ||
          previous.afterStateId !== entry.beforeStateId)) ||
      (following &&
        (following.documentId !== entry.documentId ||
          following.beforeStateId !== entry.beforeStateId))
    )
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'history continuity' });
    return new HistoryManager(new HistoryStackNode(entry, this.#undo), null);
  }
  afterUndo(entry: HistoryEntry): HistoryManager {
    if (this.#undo?.entry !== entry || this.#barrier)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'undo entry' });
    return new HistoryManager(this.#undo.next, new HistoryStackNode(entry, this.#redo));
  }
  afterRedo(entry: HistoryEntry): HistoryManager {
    if (this.#redo?.entry !== entry || this.#barrier)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'redo entry' });
    return new HistoryManager(new HistoryStackNode(entry, this.#undo), this.#redo.next);
  }
  afterBarrier(reason: BarrierReason): HistoryManager {
    return new HistoryManager(null, null, reason);
  }
}
