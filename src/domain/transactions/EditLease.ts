import { EditTransaction } from './EditTransaction.js';
import type { TransactionState } from './TransactionState.js';
import type { ChangeSet } from '../changes/ChangeSet.js';
export class EditLease {
  readonly #state: TransactionState;
  readonly tx: EditTransaction;
  constructor(state: TransactionState) {
    this.#state = state;
    this.tx = new EditTransaction(state);
    Object.freeze(this);
  }
  prepare(): ChangeSet {
    return this.#state.prepare();
  }
  rollback(): void {
    this.#state.rollback();
  }
  commitPrepared(): void {
    this.#state.commit();
  }
}
