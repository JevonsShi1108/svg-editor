import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
import type { EditFacts } from '../contracts/api.js';
export class FrontCommand extends EditCommand {
  readonly #id: string;
  constructor(id: string) {
    super();
    this.#id = id;
  }
  override run(doc: SvgDocument, tx: EditTransaction): EditFacts {
    const node = doc.require(this.#id);
    doc.bringToFront(tx, node);
    return {
      operation: 'front',
      action: 'brought to front',
      targetIds: [this.#id],
      shapes: [node.describe()],
    };
  }
}
