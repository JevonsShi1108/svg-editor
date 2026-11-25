import { ShapeRegistry } from './ShapeRegistry.js';
import { builtinShapes } from './builtin-shapes.js';

// Default Phase 1 assembly for standalone callers.
export class ShapeFactory extends ShapeRegistry {
  constructor() {
    super(builtinShapes);
  }
}
