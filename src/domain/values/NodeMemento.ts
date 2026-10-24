import type { OwnState, OwnStateDescription } from './contracts.js';
import type { StateTarget } from '../internal/protocols.js';
import { DomainError } from '../errors/DomainError.js';
export class NodeMemento {
  readonly #target: StateTarget;
  readonly #state: OwnState;
  constructor(target: StateTarget, state: OwnState) {
    this.#target = target;
    this.#state = Object.freeze({
      attributes: Object.freeze({ ...state.attributes }),
      ...(state.text === undefined ? {} : { text: state.text }),
    });
    Object.freeze(this);
  }
  read(target: StateTarget): OwnState {
    if (target !== this.#target)
      throw new DomainError('INTERNAL_INVARIANT_ERROR', { reason: 'memento target' });
    return this.#state;
  }
  equals(other: NodeMemento): boolean {
    const right = other.read(this.#target);
    const left = this.#state;
    return (
      left.text === right.text &&
      Object.keys(left.attributes).length === Object.keys(right.attributes).length &&
      Object.keys(left.attributes).every(
        (key) =>
          Object.hasOwn(right.attributes, key) && left.attributes[key] === right.attributes[key],
      )
    );
  }
  describe(target: StateTarget): OwnStateDescription {
    const state = this.read(target);
    return Object.freeze({
      attributes: Object.freeze(
        Object.entries(state.attributes).map(([name, value]) => Object.freeze({ name, value })),
      ),
      ...(state.text === undefined ? {} : { text: state.text }),
    });
  }
}
