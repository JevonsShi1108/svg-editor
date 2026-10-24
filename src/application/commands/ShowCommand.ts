import { QueryCommand } from './QueryCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { ResultData } from '../contracts/api.js';
export class ShowCommand extends QueryCommand {
  readonly #id: string;
  constructor(id: string) {
    super();
    this.#id = id;
  }
  override run(doc: SvgDocument): ResultData {
    const node = doc.require(this.#id);
    const parent = doc.placementOf(node)!.parent.ownerShape;
    return {
      kind: 'show',
      shape: node.describe(),
      parent: parent ? { kind: 'group', id: parent.id } : { kind: 'root' },
    };
  }
}
