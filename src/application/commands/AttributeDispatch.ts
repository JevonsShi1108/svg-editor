import type { AttributeHandler, AttributeEdit } from '../contracts/AttributeHandler.js';
import type { AttributeValue } from '../../domain/values/contracts.js';
import type { Shape } from '../../domain/shapes/Shape.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
import { EditorError } from '../errors/EditorError.js';

export class AttributeDispatch {
  readonly #handlers: readonly AttributeHandler[];
  constructor(handlers: readonly AttributeHandler[] = []) {
    this.#handlers = Object.freeze([...handlers]);
  }

  set(node: Shape, attribute: string, value: AttributeValue, tx: EditTransaction): void {
    if (!this.#handlers.length) return node.set(tx, attribute, value);
    const target = node.describe();
    const matches = this.#handlers.filter((h) => h.handles(target, attribute));
    if (matches.length > 1)
      throw new EditorError('ATTRIBUTE_CONFLICT', {
        attribute,
        handlers: matches.map((h) => h.name).join(', '),
      });
    const handler = matches[0];
    if (!handler) return node.set(tx, attribute, value);
    let active = true;
    const resolve = (id: string) => {
      if (!active) throw new EditorError('ATTRIBUTE_EDIT_CLOSED');
      const part =
        id === node.id
          ? node
          : node
              .asContainer()
              ?.childrenSnapshot()
              .find((child) => child.id === id);
      if (!part) throw new EditorError('SHAPE_NOT_FOUND', { id });
      return part;
    };
    const edit: AttributeEdit = {
      describe: (id) => resolve(id).describe(),
      set: (id, key, val) => resolve(id).set(tx, key, val),
    };
    try {
      const result: unknown = handler.apply(target, attribute, value, Object.freeze(edit));
      if (result !== undefined) {
        if (result instanceof Promise) void result.catch(() => {});
        throw new EditorError('INVALID_HANDLER_RESULT', { handler: handler.name });
      }
    } finally {
      active = false;
    }
  }
}
