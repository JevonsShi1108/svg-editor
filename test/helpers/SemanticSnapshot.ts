import type {
  DocumentDescription,
  OwnStateDescription,
  TreeNodeDescription,
} from '../../src/domain/values/contracts.js';

// Independent observation normalization: sort attributes only, never siblings or text.
export class SemanticSnapshot {
  static of(document: DocumentDescription): unknown {
    const own = (state: OwnStateDescription) => ({
      attributes: [...state.attributes]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name, value }) => {
          if (typeof value === 'number' && !Number.isFinite(value))
            throw new Error('Non-finite snapshot');
          return [name, value];
        }),
      ...(state.text === undefined ? {} : { text: state.text }),
    });
    const node = (entry: TreeNodeDescription): unknown => ({
      type: entry.shape.type,
      id: entry.shape.id,
      ...own(entry.shape),
      children: entry.children.map(node),
    });
    return { size: { ...document.size }, ...own(document), children: document.children.map(node) };
  }
}
