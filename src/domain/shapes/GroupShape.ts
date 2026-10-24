import { Shape } from './Shape.js';
import { ShapeSchema } from './ShapeSchema.js';
import type { DocumentId, OwnState } from '../values/contracts.js';
import type { ValueRules } from '../values/ValueRules.js';
import type { EditTransaction } from '../transactions/EditTransaction.js';
import type { ContainerRef } from '../internal/protocols.js';
import { registerContainer } from '../internal/storage.js';
import { DomainError } from '../errors/DomainError.js';
export class GroupShape extends Shape implements ContainerRef {
  static readonly schema = new ShapeSchema('g', {}, [], 'container', [], undefined, true);
  readonly #children: Shape[] = [];
  constructor(id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    super(id, owner, rules, GroupShape.schema, state);
    registerContainer(this, (index, count, node) => {
      if (node) this.#children.splice(index, count, node);
      else this.#children.splice(index, count);
    });
  }
  get ownerShape(): Shape {
    return this;
  }
  get childCount(): number {
    return this.#children.length;
  }
  childAt(index: number): Shape {
    const node = this.#children[index];
    if (!node) throw new DomainError('INTERNAL_INVARIANT_ERROR');
    return node;
  }
  childrenSnapshot(): readonly Shape[] {
    return Object.freeze([...this.#children]);
  }
  override asContainer(): ContainerRef {
    return this;
  }
  override move(tx: EditTransaction, dx: number, dy: number): void {
    tx.assertTarget(this);
    this.rules.number(dx);
    this.rules.number(dy);
    for (const child of this.#children) child.move(tx, dx, dy);
  }
  override scale(tx: EditTransaction, factor: number): void {
    tx.assertTarget(this);
    this.rules.number(factor, 'positive', 'factor');
    for (const child of this.#children) child.scale(tx, factor);
  }
}
