import type { ShapeCreation } from '../../src/domain/values/contracts.js';
// Hand-written TEST §7.4 initial states and expected geometry, independent of production schemas.
export const shapes: readonly ShapeCreation[] = [
  { type: 'rect', id: 'r', x: 10, y: 20, width: 30, height: 40 },
  { type: 'circle', id: 'c', cx: 12, cy: 18, r: 5 },
  { type: 'ellipse', id: 'e', cx: 9, cy: 15, rx: 3, ry: 6 },
  { type: 'line', id: 'l', x1: 1, y1: 2, x2: 11, y2: 22 },
  { type: 'text', id: 't', x: 7, y: 8, text: 'A' },
  { type: 'g', id: 'g' },
];
export const moved = [
  { x: 15, y: 17, width: 30, height: 40 },
  { cx: 17, cy: 15, r: 5 },
  { cx: 14, cy: 12, rx: 3, ry: 6 },
  { x1: 6, y1: -1, x2: 16, y2: 19 },
  { x: 12, y: 5 },
  {},
];
export const scaled = [
  { x: 20, y: 40, width: 60, height: 80 },
  { cx: 24, cy: 36, r: 10 },
  { cx: 18, cy: 30, rx: 6, ry: 12 },
  { x1: 2, y1: 4, x2: 22, y2: 44 },
  { x: 14, y: 16 },
  {},
];
export const setFields = [
  ['x', 'y', 'width', 'height'],
  ['cx', 'cy', 'r'],
  ['cx', 'cy', 'rx', 'ry'],
  ['x1', 'y1', 'x2', 'y2'],
  ['x', 'y', 'text'],
  [],
];
