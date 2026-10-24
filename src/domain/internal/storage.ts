import type { StateTarget, ContainerRef, DocumentAccess } from './protocols.js';
import type { NodeMemento } from '../values/NodeMemento.js';
import type { Shape } from '../shapes/Shape.js';
import type { SvgDocument } from '../document/SvgDocument.js';
import type { MutationAuthority } from './MutationAuthority.js';
import type { BuilderAccess } from './protocols.js';
import { DomainError } from '../errors/DomainError.js';

// Internal weak capabilities. No permanent registry owns nodes or old documents.
const states = new WeakMap<
  StateTarget,
  { validate: (state: NodeMemento) => void; install: (state: NodeMemento) => void }
>();
const containers = new WeakMap<
  ContainerRef,
  (index: number, deleteCount: number, node?: Shape) => void
>();
const parents = new WeakMap<
  Shape,
  { get: () => ContainerRef | null; set: (parent: ContainerRef | null) => void }
>();
const documents = new WeakMap<SvgDocument, DocumentAccess>();
const builders = new WeakMap<SvgDocument, BuilderAccess>();
export const registerBuilder = (doc: SvgDocument, access: BuilderAccess): void => {
  builders.set(doc, access);
};
export const accessBuilder = (doc: SvgDocument): BuilderAccess => builders.get(doc)!;
export const registerState = (
  target: StateTarget,
  access: { validate: (state: NodeMemento) => void; install: (state: NodeMemento) => void },
): void => {
  states.set(target, access);
};
export const validateState = (target: StateTarget, state: NodeMemento): void => {
  states.get(target)!.validate(state);
};
export const installState = (
  authority: MutationAuthority,
  target: StateTarget,
  state: NodeMemento,
): void => {
  authority.assert(target.ownerDocumentId);
  states.get(target)!.install(state);
};
export const registerContainer = (
  target: ContainerRef,
  splice: (index: number, deleteCount: number, node?: Shape) => void,
): void => {
  containers.set(target, splice);
};
export const spliceChildren = (
  authority: MutationAuthority,
  target: ContainerRef,
  index: number,
  deleteCount: number,
  node?: Shape,
): void => {
  authority.assert(target.ownerDocumentId);
  containers.get(target)!(index, deleteCount, node);
};
export const registerParent = (
  node: Shape,
  access: { get: () => ContainerRef | null; set: (parent: ContainerRef | null) => void },
): void => {
  parents.set(node, access);
};
export const parentOf = (node: Shape): ContainerRef | null => parents.get(node)!.get();
export const installParent = (
  authority: MutationAuthority,
  node: Shape,
  parent: ContainerRef | null,
): void => {
  authority.assert(node.ownerDocumentId);
  parents.get(node)!.set(parent);
};
export const registerDocument = (doc: SvgDocument, access: DocumentAccess): void => {
  documents.set(doc, access);
};
export const accessDocument = (doc: SvgDocument): DocumentAccess => {
  const access = documents.get(doc);
  if (!access) throw new DomainError('INTERNAL_INVARIANT_ERROR');
  return access;
};
