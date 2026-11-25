import type { Command } from './Command.js';
import type { TreeDecorator } from './TreeDecorator.js';
import type { AttributeHandler } from './AttributeHandler.js';
import type { ShapeProvider } from '../../domain/shapes/ShapeProvider.js';

export interface PluginContext {
  readonly cwd: string;
  registerCommand(command: Command): void;
  registerShape(provider: ShapeProvider): void;
  registerAttribute(handler: AttributeHandler): void;
  registerDecorator(decorator: TreeDecorator): void;
}
export interface Plugin {
  activate(
    context: PluginContext,
    options: Readonly<Record<string, unknown>>,
  ): void | Promise<void>;
}
