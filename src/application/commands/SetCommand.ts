import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
import type { EditFacts } from '../contracts/api.js';
export class SetCommand extends EditCommand {
  readonly #id: string;
  readonly #attribute: string;
  readonly #value: string | number;
  constructor(id: string, attribute: string, value: string | number) {
    super();
    this.#id = id;
    this.#attribute = attribute;
    this.#value = value;
  }
  override run(doc: SvgDocument, tx: EditTransaction): EditFacts {
    const node = doc.require(this.#id);
    node.set(tx, this.#attribute, this.#value);
    return {
      operation: 'set',
      targetIds: [node.id],
      shapes: [node.describe()],
      details: { attribute: this.#attribute, value: this.#value },
    };
  }
}
