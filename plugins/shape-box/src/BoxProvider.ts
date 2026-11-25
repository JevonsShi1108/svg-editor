import {
  EditorError,
  type AttributeValue,
  type DocumentId,
  type OwnState,
  type OperationFeedback,
  type ShapeDescription,
  type ShapeProvider,
  type ShapePlan,
  type ValueRules,
} from '@svgframe/api';
import { BoxShape } from './BoxShape.js';

declare module '@svgframe/api' {
  interface RegisteredShapeFields {
    box: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly label: string;
    };
  }
}
export class BoxProvider implements ShapeProvider {
  readonly name = 'box';
  readonly xmlTag = 'g';
  readonly dataKind = 'box';
  readonly schema = BoxShape.schema;
  readonly parameters = {
    x: 'coordinate',
    y: 'coordinate',
    width: 'nonnegative',
    height: 'nonnegative',
    label: 'text',
  } as const;
  requiredChildren(id: string) {
    return [
      { id: id + '-rect', type: 'rect' },
      { id: id + '-label', type: 'text' },
    ];
  }
  construct(id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    return new BoxShape(id, owner, rules, state);
  }
  plan(id: string, fields: Readonly<Record<string, AttributeValue>>): ShapePlan {
    const { x, y, width, height, label } = fields;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      typeof label !== 'string'
    )
      throw new EditorError('INVALID_VALUE');
    const [rect, text] = this.requiredChildren(id);
    return {
      type: this.name,
      id,
      state: { attributes: { 'data-kind': this.dataKind } },
      children: [
        { ...rect!, state: { attributes: { x, y, width, height, fill: '#4a90d9' } } },
        { ...text!, state: { attributes: { x: x + 20, y: y + height / 2 + 5 }, text: label } },
      ],
    };
  }
  feedback(
    operation: string,
    shape: ShapeDescription,
    details: Readonly<Record<string, AttributeValue>>,
  ): OperationFeedback | undefined {
    const id = shape.id,
      target = 'box#' + id;
    if (operation === 'create')
      return {
        commit:
          `${target} created (g#${id} + rect#${id}-rect + text#${id}-label)` +
          (details.parentId ? ' in ' + details.parentId : ''),
      };
    if (operation === 'move') {
      const { dx, dy } = details;
      const commit = `${target} moved by (${dx},${dy})`;
      return {
        commit,
        undo: `${target} moved back by (${-Number(dx)},${-Number(dy)})`,
        redo: commit,
      };
    }
    return undefined;
  }
}
