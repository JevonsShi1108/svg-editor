import { EditCommand } from './EditCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
import type { EditFacts } from '../contracts/api.js';
export class GroupCommand extends EditCommand {
  readonly #newId: string;
  readonly #ids: readonly string[];
  constructor(newId: string, ids: readonly string[]) {
    super();
    this.#newId = newId;
    this.#ids = Object.freeze([...ids]);
  }
  override run(doc: SvgDocument, tx: EditTransaction): EditFacts {
    const group = doc.group(
      tx,
      doc.planGroup(
        this.#newId,
        this.#ids.map((id) => doc.require(id)),
      ),
    );
    return {
      operation: 'group',
      action: 'created',
      targetIds: [this.#newId, ...this.#ids],
      shapes: [group.describe()],
      details: { childCount: group.childCount },
    };
  }
}
