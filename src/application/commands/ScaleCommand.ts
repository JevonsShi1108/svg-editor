import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
import type { EditFacts } from '../contracts/api.js';
export class ScaleCommand extends EditCommand {
  readonly #id: string;
  readonly #factor: number;
  constructor(id: string, factor: number) {
    super();
    this.#id = id;
    this.#factor = factor;
  }
  override run(doc: SvgDocument, tx: EditTransaction): EditFacts {
    const node = doc.require(this.#id);
    node.scale(tx, this.#factor);
    return {
      operation: 'scale',
      targetIds: [node.id],
      shapes: [node.describe()],
      details: { factor: this.#factor },
    };
  }
}
