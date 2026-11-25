import type { Command } from '../contracts/Command.js';
import { extensionCommand, type CommandRequest } from '../contracts/api.js';
import type { CommandBinding } from './CommandRegistry.js';
import type { CommandArguments } from './CommandArguments.js';
import { PluginQuery } from './PluginQuery.js';
import type { ShapeRegistry } from '../../domain/shapes/ShapeRegistry.js';
import { EditorError } from '../errors/EditorError.js';

export class PluginCommandBinding implements CommandBinding {
  readonly fields = ['name', 'args'];
  constructor(
    private readonly command: Command,
    private readonly shapes: ShapeRegistry,
  ) {}
  get help() {
    return this.command.help;
  }
  parse(args: CommandArguments): CommandRequest {
    args.expect(...this.command.arity);
    return {
      command: extensionCommand,
      name: this.help.name,
      args: args.tokens.map((t) => t.value),
    };
  }
  bind(request: CommandRequest): PluginQuery {
    if (
      request.command !== extensionCommand ||
      !Array.isArray(request.args) ||
      request.name !== this.help.name ||
      !request.args.every((value) => typeof value === 'string') ||
      request.args.length < this.command.arity[0] ||
      request.args.length > this.command.arity[1]
    )
      throw new EditorError('SYNTAX_ERROR');
    return new PluginQuery(this.command, Object.freeze([...request.args]), this.shapes);
  }
}
