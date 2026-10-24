import type { SvgDocument } from '../document/SvgDocument.js';
import type { AppliedChange, ReplayWriter, StateTarget, Placement } from '../internal/protocols.js';
import type { Shape } from '../shapes/Shape.js';
import type { NodeMemento } from '../values/NodeMemento.js';
import type { Direction, DocumentId } from '../values/contracts.js';
import type { Change } from '../changes/Change.js';
import { ChangeSet } from '../changes/ChangeSet.js';
import { NodeStateChange } from '../changes/NodeStateChange.js';
import { PlacementChange } from '../changes/PlacementChange.js';
import { accessDocument } from '../internal/storage.js';
import { MutationAuthority } from '../internal/MutationAuthority.js';
import { DomainError } from '../errors/DomainError.js';
export type TransactionPhase = 'active' | 'prepared' | 'committed' | 'rolled-back' | 'poisoned';
export class TransactionState {
  #phase: TransactionPhase = 'active';
  readonly #authority: MutationAuthority;
  readonly #records: AppliedChange[] = [];
  readonly #doc: SvgDocument;
  readonly #close: () => void;
  constructor(doc: SvgDocument, close: () => void) {
    this.#doc = doc;
    this.#close = close;
    this.#authority = new MutationAuthority(doc.documentId);
  }
  get phase(): TransactionPhase {
    return this.#phase;
  }
  get documentId(): DocumentId {
    return this.#doc.documentId;
  }
  assertActive(): void {
    if (this.#phase !== 'active') throw new DomainError('TRANSACTION_CLOSED');
  }
  assertDocument(id: DocumentId): void {
    this.assertActive();
    if (id !== this.documentId)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'cross document' });
  }
  assertTarget(target: StateTarget): void {
    this.assertDocument(target.ownerDocumentId);
    if (target !== this.#doc.root && !this.#doc.isAttached(target as Shape))
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'inactive target' });
  }
  changeState(target: StateTarget, next: NodeMemento): void {
    this.assertTarget(target);
    const before = target.captureState();
    if (!target.stateEquals(before, next))
      this.applyRecorded(new NodeStateChange(target, before, next), 'forward');
  }
  place(node: Shape, next: Placement | null): void {
    this.assertDocument(node.ownerDocumentId);
    const before = this.#doc.placementOf(node);
    accessDocument(this.#doc).validatePlacement(node, before, next);
    if (before?.parent === next?.parent && before?.index === next?.index) return;
    this.applyRecorded(new PlacementChange(node, before, next), 'forward');
  }
  applyRecorded(change: Change, direction: Direction): void {
    this.assertActive();
    this.apply(change, direction, true);
  }
  private apply(change: Change, direction: Direction, record: boolean): void {
    const access = accessDocument(this.#doc);
    let writes = 0;
    const perform = (validate: () => void, write: () => void) => {
      if (++writes !== 1) throw new DomainError('INTERNAL_INVARIANT_ERROR');
      validate();
      const entry = Object.freeze({ change, direction });
      if (record) this.#records.push(entry);
      try {
        write();
      } catch (error) {
        this.finish('poisoned');
        throw new DomainError('UNTRUSTED', {}, { cause: error });
      }
    };
    const writer: ReplayWriter = {
      state: (target, expected, next) =>
        perform(
          () => access.validateState(target, expected, next),
          () => access.writeState(this.#authority, target, next),
        ),
      placement: (node, expected, next) =>
        perform(
          () => access.validatePlacement(node, expected, next),
          () => access.writePlacement(this.#authority, node, next),
        ),
    };
    change.replayUsing(writer, direction);
  }
  prepare(): ChangeSet {
    this.assertActive();
    const changes = new ChangeSet(this.documentId, this.#records);
    this.#phase = 'prepared';
    return changes;
  }
  commit(): void {
    if (this.#phase !== 'prepared') throw new DomainError('TRANSACTION_CLOSED');
    this.finish('committed');
  }
  rollback(): void {
    if (this.#phase !== 'active' && this.#phase !== 'prepared')
      throw new DomainError(this.#phase === 'poisoned' ? 'UNTRUSTED' : 'TRANSACTION_CLOSED');
    try {
      for (let i = this.#records.length - 1; i >= 0; i--) {
        const r = this.#records[i]!;
        this.apply(r.change, r.direction === 'forward' ? 'backward' : 'forward', false);
      }
      this.finish('rolled-back');
    } catch (error) {
      if (this.phase !== 'poisoned') this.finish('poisoned');
      throw new DomainError('UNTRUSTED', {}, { cause: error });
    }
  }
  private finish(phase: TransactionPhase): void {
    this.#phase = phase;
    this.#authority.revoke();
    this.#close();
  }
}
