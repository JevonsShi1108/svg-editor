import type { DocumentDescription, TreeNodeDescription } from '../../domain/values/contracts.js';

export interface TreeDecorator {
  readonly name: string;
  checkpoint?(saved: DocumentDescription | null, repairedIds: readonly string[]): void;
  prepare(document: DocumentDescription): (row: TreeNodeDescription | null) => string | undefined;
}
