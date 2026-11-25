import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
import type { EditFacts } from '../contracts/api.js';
import { AttributeDispatch } from './AttributeDispatch.js';
export class SetCommand extends EditCommand {
  readonly #id: string;
  readonly #attribute: string;
  readonly #value: string | number;
  constructor(
    id: string,
    attribute: string,
    value: string | number,
    private readonly handlers = new AttributeDispatch(),
  ) {
    super();
    this.#id = id;
    this.#attribute = attribute;
    this.#value = value;
  }
  override run(doc: SvgDocument, tx: EditTransaction): EditFacts {
    const node = doc.require(this.#id);
    if (Object.hasOwn(node.schema.geometry, this.#attribute)) doc.assertIndependent(node);
    this.handlers.set(node, this.#attribute, this.#value, tx);
    return {
      operation: 'set',
      action: 'updated',
      targetIds: [node.id],
      shapes: [node.describe()],
      details: { attribute: this.#attribute, value: this.#value },
    };
  }
}
