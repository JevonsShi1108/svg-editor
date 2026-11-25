import type { TreeDecorator } from '../contracts/TreeDecorator.js';
import type { ResultData } from '../contracts/api.js';
import type { DocumentDescription, TreeNodeDescription } from '../../domain/values/contracts.js';
import { EditorError } from '../errors/EditorError.js';

export class TreeDecorations {
  readonly #decorators: readonly TreeDecorator[];
  readonly #failed = new Set<TreeDecorator>();
  constructor(decorators: readonly TreeDecorator[]) {
    this.#decorators = [...decorators];
  }
  get hasObservers() {
    return this.#decorators.some((d) => d.checkpoint !== undefined);
  }

  checkpoint(document: DocumentDescription | null, repaired: readonly string[] = []) {
    for (const decorator of this.#decorators) {
      try {
        decorator.checkpoint?.(document, Object.freeze(repaired));
        this.#failed.delete(decorator);
      } catch {
        this.#failed.add(decorator);
      }
    }
  }

  apply(data: ResultData, snapshot: () => DocumentDescription): ResultData {
    if (data.kind !== 'tree' || !this.#decorators.length) return data;
    const document = data.document ?? snapshot();
    const callbacks = this.#decorators.map((decorator) => {
      try {
        if (this.#failed.has(decorator)) throw Error();
        const label = decorator.prepare(document);
        return (row: TreeNodeDescription | null) => {
          try {
            const value = label(row);
            if (value !== undefined && (typeof value !== 'string' || /[\r\n]/.test(value)))
              throw Error();
            return value;
          } catch {
            throw new EditorError('DECORATOR_FAILED', { name: decorator.name });
          }
        };
      } catch {
        throw new EditorError('DECORATOR_FAILED', { name: decorator.name });
      }
    });
    const labels = (row: TreeNodeDescription | null) =>
      callbacks.flatMap((f) => {
        const value = f(row);
        return value ? [value] : [];
      });
    const visit = (node: TreeNodeDescription): TreeNodeDescription => ({
      ...node,
      labels: labels(node),
      children: node.children.map(visit),
    });
    return data.node
      ? { kind: 'tree', node: visit(data.node) }
      : {
          kind: 'tree',
          document: { ...document, labels: labels(null), children: document.children.map(visit) },
        };
  }
}
