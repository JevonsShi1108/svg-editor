import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
import type { EditFacts } from '../contracts/api.js';
export class AddToCommand extends EditCommand {
  readonly #id: string;
  readonly #containerId: string;
  constructor(containerId: string, id: string) {
    super();
    this.#id = id;
    this.#containerId = containerId;
  }
  override run(doc: SvgDocument, tx: EditTransaction): EditFacts {
    const node = doc.require(this.#id);
    doc.addTo(tx, node, doc.requireContainer(this.#containerId));
    return {
      operation: 'addto',
      action: 'moved',
      targetIds: [this.#id],
      shapes: [node.describe()],
      details: { parentId: this.#containerId },
    };
  }
}
