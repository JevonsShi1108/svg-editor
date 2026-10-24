import { QueryCommand } from './QueryCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { ResultData } from '../contracts/api.js';
export class TreeCommand extends QueryCommand {
  readonly #id: string | undefined;
  constructor(id?: string) {
    super();
    this.#id = id;
  }
  override run(doc: SvgDocument): ResultData {
    return this.#id === undefined
      ? { kind: 'tree', document: doc.describe() }
      : { kind: 'tree', node: doc.describeTree(doc.require(this.#id)) };
  }
}
