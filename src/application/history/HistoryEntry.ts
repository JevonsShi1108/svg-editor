import type { DocumentId } from '../../domain/values/contracts.js';
import type { ChangeSet } from '../../domain/changes/ChangeSet.js';
import type { StateId, OperationDescription, HistoryEntryValue } from '../contracts/history.js';
import { DomainError } from '../../domain/errors/DomainError.js';
export class HistoryEntry implements HistoryEntryValue {
  readonly description: OperationDescription;
  constructor(
    readonly documentId: DocumentId,
    readonly beforeStateId: StateId,
    readonly afterStateId: StateId,
    readonly changes: ChangeSet,
    description: OperationDescription,
  ) {
    if (documentId !== changes.documentId || changes.isEmpty || beforeStateId === afterStateId)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'history entry' });
    this.description = Object.freeze({
      operation: description.operation,
      targetIds: Object.freeze([...description.targetIds]),
    });
    Object.freeze(this);
  }
}
