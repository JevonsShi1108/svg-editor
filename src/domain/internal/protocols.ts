import type { DocumentId, OwnStateDescription, Direction } from '../values/contracts.js';
import type { NodeMemento } from '../values/NodeMemento.js';
import type { Shape } from '../shapes/Shape.js';
import type { MutationAuthority } from './MutationAuthority.js';
export interface StateTarget {
  describeTarget(): import('../values/contracts.js').StateTargetDescription;
  readonly ownerDocumentId: DocumentId;
  captureState(): NodeMemento;
  stateEquals(left: NodeMemento, right: NodeMemento): boolean;
  describeState(state: NodeMemento): OwnStateDescription;
}
export interface ContainerRef {
  readonly ownerDocumentId: DocumentId;
  readonly ownerShape: Shape | null;
  readonly childCount: number;
  childAt(index: number): Shape;
  childrenSnapshot(): readonly Shape[];
}
export interface Placement {
  readonly parent: ContainerRef;
  readonly index: number;
}
export interface GroupPlan {
  readonly documentId: DocumentId;
  readonly newId: string;
  readonly parent: ContainerRef;
  readonly initialInsertionIndex: number;
  readonly selectedInDocumentOrder: readonly Shape[];
}
export interface ReplayWriter {
  state(target: StateTarget, expected: NodeMemento, next: NodeMemento): void;
  placement(node: Shape, expected: Placement | null, next: Placement | null): void;
}
export interface DocumentAccess {
  validateState(target: StateTarget, expected: NodeMemento, next: NodeMemento): void;
  writeState(authority: MutationAuthority, target: StateTarget, next: NodeMemento): void;
  validatePlacement(node: Shape, expected: Placement | null, next: Placement | null): void;
  writePlacement(authority: MutationAuthority, node: Shape, next: Placement | null): void;
}
export interface AppliedChange {
  readonly change: import('../changes/Change.js').Change;
  readonly direction: Direction;
}
export interface BuilderAccess {
  append(
    type: string,
    id: string,
    state: import('../values/contracts.js').OwnState,
    parent: ContainerRef,
  ): Shape;
  finish(): void;
}
