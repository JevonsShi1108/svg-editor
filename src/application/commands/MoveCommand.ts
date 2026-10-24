import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
import type { EditFacts } from '../contracts/api.js';
export class MoveCommand extends EditCommand {
  readonly #id: string;
  readonly #dx: number;
  readonly #dy: number;
  constructor(id: string, dx: number, dy: number) {
    super();
    this.#id = id;
    this.#dx = dx;
    this.#dy = dy;
  }
  override run(doc: SvgDocument, tx: EditTransaction): EditFacts {
    const node = doc.require(this.#id);
    node.move(tx, this.#dx, this.#dy);
    return {
      operation: 'move',
      targetIds: [node.id],
      shapes: [node.describe()],
      details: { dx: this.#dx, dy: this.#dy },
    };
  }
}
