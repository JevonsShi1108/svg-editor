import type { TransactionState, TransactionPhase } from './TransactionState.js';
import type { DocumentId, Direction } from '../values/contracts.js';
import type { StateTarget, Placement } from '../internal/protocols.js';
import type { Shape } from '../shapes/Shape.js';
import type { NodeMemento } from '../values/NodeMemento.js';
import type { Change } from '../changes/Change.js';
export class EditTransaction {
  readonly #state: TransactionState;
  constructor(state: TransactionState) {
    this.#state = state;
    Object.freeze(this);
  }
  get phase(): TransactionPhase {
    return this.#state.phase;
  }
  get documentId(): DocumentId {
    return this.#state.documentId;
  }
  assertDocument(id: DocumentId): void {
    this.#state.assertDocument(id);
  }
  assertTarget(target: StateTarget): void {
    this.#state.assertTarget(target);
  }
  changeState(target: StateTarget, next: NodeMemento): void {
    this.#state.changeState(target, next);
  }
  place(node: Shape, destination: Placement | null): void {
    this.#state.place(node, destination);
  }
  applyRecorded(change: Change, direction: Direction): void {
    this.#state.applyRecorded(change, direction);
  }
}
