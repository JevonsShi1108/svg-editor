import { SvgDocumentBuilder } from '../../src/domain/document/SvgDocumentBuilder.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import type { ContainerRef } from '../../src/domain/internal/protocols.js';
import type { ResourceLimits } from '../../src/domain/values/contracts.js';
export type TreeInput = string | readonly [string, ...TreeInput[]];
export const buildTree = (tree: readonly TreeInput[], limits: ResourceLimits = defaultLimits) => {
  const builder = new SvgDocumentBuilder(limits);
  const add = (entries: readonly TreeInput[], parent: ContainerRef) => {
    for (const entry of entries) {
      if (typeof entry === 'string')
        builder.append('rect', entry, { attributes: { x: 1, y: 2, width: 3, height: 4 } }, parent);
      else {
        const [id, ...children] = entry;
        const g = builder.append('g', id, { attributes: {} }, parent);
        add(children, g.asContainer()!);
      }
    }
  };
  add(tree, builder.root);
  return builder.build();
};
export const ids = (parent: ContainerRef) => parent.childrenSnapshot().map((n) => n.id);
