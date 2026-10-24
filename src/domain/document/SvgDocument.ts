import type {
  CanvasSize,
  DocumentDescription,
  DocumentId,
  OwnState,
  ResourceLimits,
  ShapeCreation,
  TreeNodeDescription,
} from '../values/contracts.js';
import type { ContainerRef, Placement, StateTarget } from '../internal/protocols.js';
import type { EditTransaction } from '../transactions/EditTransaction.js';
import type { Shape } from '../shapes/Shape.js';
import { CanvasRoot } from './CanvasRoot.js';
import { ShapeFactory } from '../shapes/ShapeFactory.js';
import { ValueRules } from '../values/ValueRules.js';
import { NodeMemento } from '../values/NodeMemento.js';
import { DomainError } from '../errors/DomainError.js';
import { EditLease } from '../transactions/EditLease.js';
import { TransactionState } from '../transactions/TransactionState.js';
import { MutationAuthority } from '../internal/MutationAuthority.js';
import {
  registerDocument,
  registerBuilder,
  validateState,
  installState,
  parentOf,
  installParent,
  spliceChildren,
} from '../internal/storage.js';
export class SvgDocument {
  readonly #id = Symbol('document') as DocumentId;
  readonly #root: CanvasRoot;
  readonly #index = new Map<string, Shape>();
  readonly #rules: ValueRules;
  readonly #factory: ShapeFactory;
  #active = false;
  #published = false;
  constructor(
    limits: ResourceLimits,
    size: CanvasSize,
    attributes: OwnState['attributes'] = {},
    factory = new ShapeFactory(),
  ) {
    this.#rules = new ValueRules(limits);
    this.#factory = factory;
    this.#root = new CanvasRoot(this.#id, this.#rules, {
      attributes: { ...attributes, ...this.#rules.size(size) },
    });
    registerDocument(this, {
      validateState: (target, expected, next) => {
        this.assertStateTarget(target);
        if (!target.stateEquals(target.captureState(), expected))
          throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'state mismatch' });
        validateState(target, next);
      },
      writeState: (authority, target, next) => installState(authority, target, next),
      validatePlacement: (node, expected, next) => this.validatePlacement(node, expected, next),
      writePlacement: (authority, node, next) => this.writePlacement(authority, node, next),
    });
    const authority = new MutationAuthority(this.#id);
    const assertBuilding = () => {
      if (this.#published) throw new DomainError('BUILDER_CLOSED');
      authority.assert(this.#id);
    };
    registerBuilder(this, {
      append: (type, id, state, parent) => {
        assertBuilding();
        const normalized = this.#factory.definition(type).schema.validate(this.#rules, state, true);
        const node = this.#factory.create(type, id, this.#id, this.#rules, normalized);
        const next = { parent, index: parent.childCount };
        this.validatePlacement(node, null, next);
        this.writePlacement(authority, node, next);
        return node;
      },
      finish: () => {
        assertBuilding();
        this.assertInvariants();
        this.#published = true;
        authority.revoke();
      },
    });
  }
  get documentId(): DocumentId {
    return this.#id;
  }
  get root(): CanvasRoot {
    return this.#root;
  }
  get nodeCount(): number {
    return this.#index.size;
  }
  find(id: string): Shape | undefined {
    return this.#index.get(id);
  }
  require(id: string): Shape {
    const node = this.find(id);
    if (!node) throw new DomainError('SHAPE_NOT_FOUND', { id });
    return node;
  }
  requireContainer(id: string): ContainerRef {
    const node = this.find(id);
    if (!node) throw new DomainError('CONTAINER_NOT_FOUND', { id });
    const container = node.asContainer();
    if (!container) throw new DomainError('NOT_A_CONTAINER', { id });
    return container;
  }
  isAttached(node: Shape): boolean {
    return this.#index.get(node.id) === node;
  }
  placementOf(node: Shape): Placement | null {
    if (node.ownerDocumentId !== this.#id)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'cross document' });
    const parent = parentOf(node);
    if (!parent) return null;
    const index = parent.childrenSnapshot().indexOf(node);
    if (index < 0) throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'missing child' });
    return Object.freeze({ parent, index });
  }
  beginEdit(): EditLease {
    if (!this.#published || this.#active) throw new DomainError('TRANSACTION_BUSY');
    this.#active = true;
    return new EditLease(
      new TransactionState(this, () => {
        this.#active = false;
      }),
    );
  }
  create(tx: EditTransaction, creation: ShapeCreation, parent: ContainerRef = this.root): Shape {
    tx.assertDocument(this.#id);
    const node = this.#factory.fromCreation(creation, this.#id, this.#rules);
    tx.place(node, { parent, index: parent.childCount });
    return node;
  }
  resizeCanvas(tx: EditTransaction, size: CanvasSize): void {
    tx.assertTarget(this.root);
    const state = this.root.captureState().read(this.root);
    tx.changeState(
      this.root,
      new NodeMemento(this.root, {
        attributes: { ...state.attributes, ...this.#rules.size(size) },
      }),
    );
  }
  describeTree(node: Shape): TreeNodeDescription {
    return Object.freeze({
      shape: node.describe(),
      children: Object.freeze(
        (node.asContainer()?.childrenSnapshot() ?? []).map((child) => this.describeTree(child)),
      ),
    });
  }
  describe(): DocumentDescription {
    const state = this.root.describeState(this.root.captureState());
    return Object.freeze({
      size: this.root.size,
      attributes: Object.freeze(
        state.attributes.filter(({ name }) => name !== 'width' && name !== 'height'),
      ),
      children: Object.freeze(this.root.childrenSnapshot().map((node) => this.describeTree(node))),
    });
  }
  private assertStateTarget(target: StateTarget): void {
    if (
      target.ownerDocumentId !== this.#id ||
      (target !== this.root && !this.isAttached(target as Shape))
    )
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'inactive state target' });
  }
  private subtree(node: Shape): Shape[] {
    const result: Shape[] = [];
    const visit = (n: Shape) => {
      result.push(n);
      for (const child of n.asContainer()?.childrenSnapshot() ?? []) visit(child);
    };
    visit(node);
    return result;
  }
  private depth(parent: ContainerRef): number {
    let depth = 0;
    let node = parent.ownerShape;
    while (node) {
      depth++;
      node = parentOf(node)?.ownerShape ?? null;
    }
    return depth;
  }
  private height(node: Shape): number {
    return Math.max(
      0,
      ...(node.asContainer()?.childrenSnapshot() ?? []).map((n) => 1 + this.height(n)),
    );
  }
  private validatePlacement(node: Shape, expected: Placement | null, next: Placement | null): void {
    if (node.ownerDocumentId !== this.#id)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'cross document' });
    const actual = this.placementOf(node);
    if (actual?.parent !== expected?.parent || actual?.index !== expected?.index)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'placement mismatch' });
    const active = this.isAttached(node);
    if (actual && !active)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'detached descendant' });
    if (!next) return;
    const parent = next.parent;
    if (
      parent.ownerDocumentId !== this.#id ||
      (parent !== this.root &&
        (!parent.ownerShape ||
          !this.isAttached(parent.ownerShape) ||
          parent.ownerShape.asContainer() !== parent))
    )
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'inactive container' });
    for (
      let ancestor = parent.ownerShape;
      ancestor;
      ancestor = parentOf(ancestor)?.ownerShape ?? null
    )
      if (ancestor === node) throw new DomainError('INVALID_HIERARCHY', { id: node.id });
    const available = parent.childCount - (actual?.parent === parent ? 1 : 0);
    if (!Number.isSafeInteger(next.index) || next.index < 0 || next.index > available)
      throw new DomainError('INVALID_PLACEMENT');
    if (actual?.parent === parent) return;
    if (!active) {
      const nodes = this.subtree(node);
      const seen = new Set<string>();
      for (const item of nodes) {
        if (this.#index.has(item.id) || seen.has(item.id))
          throw new DomainError('DUPLICATE_ID', { id: item.id });
        seen.add(item.id);
      }
      if (this.nodeCount + nodes.length > this.#rules.limits.maxNodeCount)
        throw new DomainError('RESOURCE_LIMIT', { field: 'nodes' });
    }
    if (this.depth(parent) + 1 + this.height(node) > this.#rules.limits.maxTreeDepth)
      throw new DomainError('RESOURCE_LIMIT', { field: 'depth' });
  }
  private writePlacement(authority: MutationAuthority, node: Shape, next: Placement | null): void {
    authority.assert(this.#id);
    const from = this.placementOf(node);
    const nodes = !from || !next ? this.subtree(node) : [];
    if (from) spliceChildren(authority, from.parent, from.index, 1);
    if (next) spliceChildren(authority, next.parent, next.index, 0, node);
    installParent(authority, node, next?.parent ?? null);
    if (from && !next) for (const item of nodes) this.#index.delete(item.id);
    if (!from && next) for (const item of nodes) this.#index.set(item.id, item);
  }
  assertInvariants(): void {
    const seen = new Map<string, Shape>();
    const identities = new Set<Shape>();
    const visit = (parent: ContainerRef, depth: number) => {
      for (const node of parent.childrenSnapshot()) {
        if (
          identities.has(node) ||
          seen.has(node.id) ||
          node.ownerDocumentId !== this.#id ||
          parentOf(node) !== parent ||
          this.#index.get(node.id) !== node ||
          depth > this.#rules.limits.maxTreeDepth
        )
          throw new DomainError('INTERNAL_INVARIANT_ERROR');
        identities.add(node);
        seen.set(node.id, node);
        validateState(node, node.captureState());
        const container = node.asContainer();
        if (container) visit(container, depth + 1);
      }
    };
    visit(this.root, 1);
    if (seen.size !== this.nodeCount || this.nodeCount > this.#rules.limits.maxNodeCount)
      throw new DomainError('INTERNAL_INVARIANT_ERROR');
  }
}
