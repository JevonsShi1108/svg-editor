import type { ResourceLimits } from '../../domain/values/contracts.js';
import type { ShapeRegistry } from '../../domain/shapes/ShapeRegistry.js';
import { ShapeFactory } from '../../domain/shapes/ShapeFactory.js';
import { BuiltinCommands } from './BuiltinCommands.js';
import { CommandRegistry, type CommandBinding } from './CommandRegistry.js';

import { AttributeDispatch } from './AttributeDispatch.js';
// Phase 1 composition entry point, also used by embedders without optional plugins.
export class CommandCatalog extends CommandRegistry {
  constructor(
    limits: ResourceLimits,
    factory: ShapeRegistry = new ShapeFactory(),
    additions: readonly CommandBinding[] = [],
    attributes = new AttributeDispatch(),
  ) {
    super(limits, [...new BuiltinCommands(limits, factory, attributes).definitions, ...additions]);
  }
}
