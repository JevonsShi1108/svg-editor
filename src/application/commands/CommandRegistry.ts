import type { CommandRequest, CommandHelp, InputToken, CommandParser } from '../contracts/api.js';
import type { ResourceLimits } from '../../domain/values/contracts.js';
import { ValueRules } from '../../domain/values/ValueRules.js';
import { EditorError } from '../errors/EditorError.js';
import { FrozenValue } from '../internal/FrozenValue.js';
import type { BoundCommand } from './BoundCommand.js';
import { CommandArguments } from './CommandArguments.js';
import { extensionCommand } from '../contracts/api.js';
export interface CommandBinding {
  readonly help: CommandHelp;
  readonly fields: readonly string[];
  parse(args: CommandArguments): CommandRequest;
  bind(request: CommandRequest): BoundCommand;
}
export class CommandRegistry implements CommandParser {
  readonly #definitions = new Map<string, CommandBinding>();
  readonly #rules: ValueRules;

  constructor(limits: ResourceLimits, commands: readonly CommandBinding[]) {
    this.#rules = new ValueRules(limits);
    for (const command of commands) {
      const name = command.help.name;
      if (this.#definitions.has(name))
        throw new EditorError('DUPLICATE_REGISTRATION', { category: 'commands', name });
      this.#definitions.set(name, command);
    }
  }
  parse(tokens: readonly InputToken[]): CommandRequest {
    const name = tokens[0]?.value;
    if (!name) throw new EditorError('SYNTAX_ERROR');
    const definition = this.definition(name);
    return FrozenValue.copy(definition.parse(new CommandArguments(tokens.slice(1), this.#rules)));
  }
  bind(request: CommandRequest): BoundCommand {
    if (!request || typeof request !== 'object' || typeof request.command !== 'string')
      throw new EditorError('SYNTAX_ERROR');
    const definition = this.definition(
      request.command === extensionCommand ? request.name : request.command,
    );
    if (Object.keys(request).some((key) => key !== 'command' && !definition.fields.includes(key)))
      throw new EditorError('SYNTAX_ERROR');
    return definition.bind(request);
  }
  describe(): readonly CommandHelp[] {
    return Object.freeze([...this.#definitions.values()].map((d) => d.help));
  }
  private definition(name: string): CommandBinding {
    const definition = this.#definitions.get(name);
    if (!definition) throw new EditorError('UNKNOWN_COMMAND', { command: name });
    return definition;
  }
}
