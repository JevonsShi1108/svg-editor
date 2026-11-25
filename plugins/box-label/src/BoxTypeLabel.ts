import type { TreeDecorator, TreeNodeDescription } from '@svgframe/api';
export class BoxTypeLabel implements TreeDecorator {
  readonly name = 'box-type-label';
  prepare() {
    return (row: TreeNodeDescription | null) => (row?.shape.type === 'box' ? '(box)' : undefined);
  }
}
