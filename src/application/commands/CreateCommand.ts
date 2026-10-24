import { EditCommand } from './EditCommand.js';
import type { ShapeCreation } from '../../domain/values/contracts.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
import type { EditFacts } from '../contracts/api.js';
export class CreateCommand extends EditCommand {
  readonly #creation: ShapeCreation;
  readonly #parentId: string | undefined;
  constructor(creation: ShapeCreation, parentId?: string) {
    super();
    this.#creation = creation;
    this.#parentId = parentId;
  }
  override run(doc: SvgDocument, tx: EditTransaction): EditFacts {
    const parent = this.#parentId === undefined ? doc.root : doc.requireContainer(this.#parentId);
    const node = doc.create(tx, this.#creation, parent);
    return {
      operation: 'create',
      action: 'created',
      targetIds: [node.id],
      shapes: [node.describe()],
      ...(this.#parentId === undefined ? {} : { details: { parentId: this.#parentId } }),
    };
  }
}
