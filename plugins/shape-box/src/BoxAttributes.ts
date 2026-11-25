import type {
  AttributeHandler,
  AttributeEdit,
  ShapeDescription,
  AttributeValue,
} from '@svgframe/api';

export class BoxAttributes implements AttributeHandler {
  readonly name = 'box-attributes';
  handles(target: ShapeDescription, attribute: string) {
    return target.type === 'box' && (attribute === 'fill' || attribute === 'label');
  }
  apply(target: ShapeDescription, attribute: string, value: AttributeValue, edit: AttributeEdit) {
    const id = target.id;
    if (attribute === 'fill') {
      const part = id + '-rect';
      const before = edit.describe(part).attributes.find((a) => a.name === 'fill')?.value;
      edit.set(part, 'fill', value);
      const commit = `box#${id} fill propagated to ${part}`;
      edit.feedback({
        commit,
        undo: `box#${id} fill restored: ${before ?? '(unset)'}`,
        redo: commit,
      });
    } else {
      const part = id + '-label',
        before = edit.describe(part).text ?? '';
      edit.set(part, 'text', value);
      const commit = `box#${id} label updated: ${JSON.stringify(value)}`;
      edit.feedback({
        commit,
        undo: `box#${id} label restored: ${JSON.stringify(before)}`,
        redo: commit,
      });
    }
  }
}
