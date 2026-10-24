import type { DocumentId } from '../../domain/values/contracts.js';
import type { ChangeSet } from '../../domain/changes/ChangeSet.js';
declare const stateBrand: unique symbol;
export type StateId = symbol & { readonly [stateBrand]: true };
export type BarrierReason = 'init' | 'read' | 'save' | 'canvas';
export interface HistoryStatus {
  readonly undoCount: number;
  readonly redoCount: number;
  readonly barrier: BarrierReason | null;
}
export interface OperationDescription {
  readonly operation: string;
  readonly targetIds: readonly string[];
}
export interface HistoryEntryValue {
  readonly documentId: DocumentId;
  readonly beforeStateId: StateId;
  readonly afterStateId: StateId;
  readonly changes: ChangeSet;
  readonly description: OperationDescription;
}
