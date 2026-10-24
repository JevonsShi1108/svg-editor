import type { DocumentId, Direction } from '../values/contracts.js';
import type { AppliedChange } from '../internal/protocols.js';
import type { EditTransaction } from '../transactions/EditTransaction.js';
export class ChangeSet {
  readonly #records: readonly AppliedChange[];
  constructor(
    readonly documentId: DocumentId,
    records: readonly AppliedChange[],
  ) {
    this.#records = Object.freeze(records.map((r) => Object.freeze({ ...r })));
    Object.freeze(this);
  }
  get size(): number {
    return this.#records.length;
  }
  get isEmpty(): boolean {
    return this.size === 0;
  }
  replay(tx: EditTransaction, direction: Direction): void {
    tx.assertDocument(this.documentId);
    const records = direction === 'forward' ? this.#records : [...this.#records].reverse();
    for (const record of records)
      tx.applyRecorded(
        record.change,
        direction === 'forward'
          ? record.direction
          : record.direction === 'forward'
            ? 'backward'
            : 'forward',
      );
  }
  describe(direction: Direction): readonly unknown[] {
    const records = direction === 'forward' ? this.#records : [...this.#records].reverse();
    return Object.freeze(
      records.map((r) =>
        r.change.describe(
          direction === 'forward'
            ? r.direction
            : r.direction === 'forward'
              ? 'backward'
              : 'forward',
        ),
      ),
    );
  }
}
