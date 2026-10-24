import { expect } from 'vitest';
import type { SvgDocument } from '../../src/domain/document/SvgDocument.js';
import type { Shape } from '../../src/domain/shapes/Shape.js';
import type { ContainerRef } from '../../src/domain/internal/protocols.js';

// Independent traversal: never calls production assertInvariants; never sorts siblings.
export class InvariantOracle {
  static check(doc: SvgDocument, deleted: readonly Shape[] = []): void {
    const identities = new Set<Shape>();
    const ids = new Set<string>();
    const visit = (parent: ContainerRef) => {
      expect(parent.ownerDocumentId).toBe(doc.documentId);
      const children = parent.childrenSnapshot();
      expect(parent.childCount).toBe(children.length);
      for (const [index, node] of children.entries()) {
        expect(identities.has(node)).toBe(false);
        identities.add(node);
        expect(ids.has(node.id)).toBe(false);
        ids.add(node.id);
        expect(parent.childAt(index)).toBe(node);
        expect(doc.find(node.id)).toBe(node);
        expect(doc.isAttached(node)).toBe(true);
        expect(node.ownerDocumentId).toBe(doc.documentId);
        expect(doc.placementOf(node)).toEqual({ parent, index });
        const container = node.asContainer();
        if (container) visit(container);
      }
    };
    visit(doc.root);
    expect(doc.nodeCount).toBe(identities.size);
    for (const node of deleted) {
      expect(doc.isAttached(node)).toBe(false);
      expect(doc.find(node.id)).not.toBe(node);
    }
  }
}
