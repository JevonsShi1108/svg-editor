import type {
  DocumentId,
  OwnState,
  ShapeDescription,
  OwnStateDescription,
} from '../values/contracts.js';
import type { ContainerRef, StateTarget } from '../internal/protocols.js';
import type { EditTransaction } from '../transactions/EditTransaction.js';
import { registerState, registerParent } from '../internal/storage.js';
import { NodeMemento } from '../values/NodeMemento.js';
import { ValueRules } from '../values/ValueRules.js';
import { ShapeSchema } from './ShapeSchema.js';
export abstract class Shape implements StateTarget {
  readonly #id: string;
  readonly #owner: DocumentId;
  #state: NodeMemento;
  #parent: ContainerRef | null = null;
  protected readonly rules: ValueRules;
  readonly #schema: ShapeSchema;
  protected constructor(
    id: string,
    owner: DocumentId,
    rules: ValueRules,
    schema: ShapeSchema,
    state: OwnState,
  ) {
    this.#id = rules.id(id);
    this.#owner = owner;
    this.rules = rules;
    this.#schema = schema;
    this.#state = new NodeMemento(this, schema.validate(rules, state));
    registerState(this, {
      validate: (next) => {
        const normalized = new NodeMemento(this, schema.validate(rules, next.read(this)));
        if (!next.equals(normalized)) throw new Error('Non-canonical memento');
      },
      install: (next) => {
        this.#state = next;
      },
    });
    registerParent(this, {
      get: () => this.#parent,
      set: (parent) => {
        this.#parent = parent;
      },
    });
  }
  get id(): string {
    return this.#id;
  }
  get ownerDocumentId(): DocumentId {
    return this.#owner;
  }
  get schema(): ShapeSchema {
    return this.#schema;
  }
  captureState(): NodeMemento {
    return this.#state;
  }
  stateEquals(a: NodeMemento, b: NodeMemento): boolean {
    a.read(this);
    b.read(this);
    return a.equals(b);
  }
  describeState(state: NodeMemento): OwnStateDescription {
    return state.describe(this);
  }
  describe(): ShapeDescription {
    const own = this.describeState(this.#state);
    return Object.freeze({
      type: this.#schema.type,
      id: this.id,
      ...own,
      displayFields: Object.freeze(
        own.attributes.map(({ name, value }) => Object.freeze({ label: name, value })),
      ),
    });
  }
  asContainer(): ContainerRef | null {
    return null;
  }
  abstract move(tx: EditTransaction, dx: number, dy: number): void;
  abstract scale(tx: EditTransaction, factor: number): void;
  set(tx: EditTransaction, attribute: string, value: string | number): void {
    this.update(tx, this.#schema.set(this.rules, this.#state.read(this), attribute, value));
  }
  delete(tx: EditTransaction): void {
    tx.assertTarget(this);
    tx.place(this, null);
  }
  protected update(tx: EditTransaction, state: OwnState): void {
    tx.assertTarget(this);
    tx.changeState(this, new NodeMemento(this, this.#schema.validate(this.rules, state)));
  }
  protected translate(
    tx: EditTransaction,
    dx: number,
    dy: number,
    xFields: readonly string[],
    yFields: readonly string[],
  ): void {
    tx.assertTarget(this);
    this.rules.number(dx);
    this.rules.number(dy);
    const state = this.#state.read(this);
    const attributes = { ...state.attributes };
    for (const [fields, delta] of [
      [xFields, dx],
      [yFields, dy],
    ] as const)
      for (const field of fields) {
        const before = (attributes[field] as number | undefined) ?? 0;
        const next = this.rules.number(before + delta);
        if (next !== before) attributes[field] = next;
      }
    this.update(tx, { ...state, attributes });
  }
  protected multiply(tx: EditTransaction, factor: number): void {
    tx.assertTarget(this);
    this.rules.number(factor, 'positive', 'factor');
    const state = this.#state.read(this);
    const attributes = { ...state.attributes };
    for (const [field, rule] of Object.entries(this.#schema.geometry))
      if (Object.hasOwn(attributes, field))
        attributes[field] = this.rules.product(attributes[field] as number, factor, rule);
    this.update(tx, { ...state, attributes });
  }
}
