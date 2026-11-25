import { expect, it } from 'vitest';
import type { AttributeEdit, ShapeCreation, ShapeDescription } from '@svgframe/api';
import { BoxProvider } from '../../plugins/shape-box/src/BoxProvider.js';
import { BoxAttributes } from '../../plugins/shape-box/src/BoxAttributes.js';

it('plans two derived parts from a typed box request, including the height-dependent label offset', () => {
  const shape: ShapeCreation = {
    type: 'box',
    id: 'n',
    x: 2,
    y: 10,
    width: 90,
    height: 40,
    label: 'a&b',
  };
  const { id, type, ...fields } = shape;
  const plan = new BoxProvider().plan(id, fields);
  expect(plan).toEqual({
    type,
    id,
    state: { attributes: { 'data-kind': 'box' } },
    children: [
      {
        id: 'n-rect',
        type: 'rect',
        state: { attributes: { x: 2, y: 10, width: 90, height: 40, fill: '#4a90d9' } },
      },
      { id: 'n-label', type: 'text', state: { attributes: { x: 22, y: 35 }, text: 'a&b' } },
    ],
  });
});
it('translates fill and label using only the supplied edit capability', () => {
  const handler = new BoxAttributes(),
    actions: unknown[] = [];
  const target: ShapeDescription = { id: 'p', type: 'box', attributes: [], displayFields: [] };
  const edit: AttributeEdit = {
    describe: (id) => ({ ...target, id, text: 'old' }),
    set: (...args) => {
      actions.push(args);
    },
    feedback: () => {},
  };
  expect(handler.handles(target, 'x')).toBe(false);
  expect(handler.handles({ ...target, type: 'rect' }, 'label')).toBe(false);
  handler.apply(target, 'fill', 'blue', edit);
  handler.apply(target, 'label', 'new', edit);
  expect(actions).toEqual([
    ['p-rect', 'fill', 'blue'],
    ['p-label', 'text', 'new'],
  ]);
});
