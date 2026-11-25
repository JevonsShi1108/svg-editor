import type {
  AttributeDescription,
  DocumentDescription,
  TreeDecorator,
  TreeNodeDescription,
} from '@svgframe/api';

interface Row {
  id: string | null;
  parent: string | null;
  signature: string;
}
function own(attributes: readonly AttributeDescription[]) {
  return attributes
    .map((a) => [a.name, a.value] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
function rows(doc: DocumentDescription) {
  const ids = (children: readonly TreeNodeDescription[]) => children.map((n) => n.shape.id);
  const result: Row[] = [
    {
      id: null,
      parent: null,
      signature: JSON.stringify([
        doc.size.width,
        doc.size.height,
        own(doc.attributes),
        ids(doc.children),
      ]),
    },
  ];
  function visit(node: TreeNodeDescription, parent: string | null) {
    const { id, type, attributes, text } = node.shape;
    result.push({
      id,
      parent,
      signature: JSON.stringify([type, parent, own(attributes), text ?? null, ids(node.children)]),
    });
    for (const child of node.children) visit(child, id);
  }
  for (const node of doc.children) visit(node, null);
  return result;
}

export class ModifiedStar implements TreeDecorator {
  readonly name = 'modified-star';
  #saved = new Map<string | null, string>();
  checkpoint(document: DocumentDescription | null, repairedIds: readonly string[]) {
    this.#saved = new Map(document ? rows(document).map((row) => [row.id, row.signature]) : []);
    for (const id of repairedIds) this.#saved.delete(id);
  }
  prepare(document: DocumentDescription) {
    const changed = new Set<string | null>();
    // Reverse preorder visits every descendant before its parent.
    for (const row of rows(document).reverse()) {
      if (changed.has(row.id) || row.signature !== this.#saved.get(row.id)) {
        changed.add(row.id);
        changed.add(row.parent);
      }
    }
    return (row: TreeNodeDescription | null) =>
      changed.has(row?.shape.id ?? null) ? '*' : undefined;
  }
}
