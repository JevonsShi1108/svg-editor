import type { CanvasSize, DocumentId, OwnState, OwnStateDescription } from '../values/contracts.js';
import type { StateTarget, ContainerRef } from '../internal/protocols.js';
import type { Shape } from '../shapes/Shape.js';
import { ShapeSchema } from '../shapes/ShapeSchema.js';
import { ValueRules } from '../values/ValueRules.js';
import { NodeMemento } from '../values/NodeMemento.js';
import { DomainError } from '../errors/DomainError.js';
import { registerState, registerContainer } from '../internal/storage.js';
export class CanvasRoot implements StateTarget, ContainerRef {
  readonly #owner: DocumentId;
  #state: NodeMemento;
  readonly #children: Shape[] = [];
  static readonly schema = new ShapeSchema(
    'svg',
    { width: 'positive', height: 'positive' },
    ['width', 'height'],
    'container',
    [],
  );
  constructor(owner: DocumentId, rules: ValueRules, state: OwnState) {
    this.#owner = owner;
    this.#state = new NodeMemento(this, CanvasRoot.schema.validate(rules, state));
    registerState(this, {
      validate: (next) => {
        const normalized = new NodeMemento(
          this,
          CanvasRoot.schema.validate(rules, next.read(this)),
        );
        if (!next.equals(normalized)) throw new DomainError('INVALID_VALUE');
      },
      install: (next) => {
        this.#state = next;
      },
    });
    registerContainer(this, (index, count, node) => {
      if (node) this.#children.splice(index, count, node);
      else this.#children.splice(index, count);
    });
  }
  get ownerDocumentId(): DocumentId {
    return this.#owner;
  }
  get ownerShape(): null {
    return null;
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
  captureState(): NodeMemento {
    return this.#state;
  }
  describeTarget(): import('../values/contracts.js').StateTargetDescription {
    return Object.freeze({ kind: 'canvas' });
  }
  stateEquals(a: NodeMemento, b: NodeMemento): boolean {
    a.read(this);
    b.read(this);
    return a.equals(b);
  }
  describeState(state: NodeMemento): OwnStateDescription {
    return state.describe(this);
  }
  get size(): CanvasSize {
    const attributes = this.#state.read(this).attributes;
    return Object.freeze({
      width: attributes.width as number,
      height: attributes.height as number,
    });
  }
}
