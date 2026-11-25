import { RectShape } from './RectShape.js';
import { CircleShape } from './CircleShape.js';
import { EllipseShape } from './EllipseShape.js';
import { LineShape } from './LineShape.js';
import { TextShape } from './TextShape.js';
import { GroupShape } from './GroupShape.js';
import { NativeShapeProvider } from './NativeShapeProvider.js';

export const builtinShapes = Object.freeze([
  new NativeShapeProvider('circle', CircleShape),
  new NativeShapeProvider('ellipse', EllipseShape),
  new NativeShapeProvider('line', LineShape),
  new NativeShapeProvider('text', TextShape),
  new NativeShapeProvider('rect', RectShape),
  new NativeShapeProvider('g', GroupShape, true),
]);
