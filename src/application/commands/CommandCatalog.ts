import type { CommandRequest, CommandHelp, InputToken, CommandParser } from '../contracts/api.js';
import type { ResourceLimits, ShapeCreation } from '../../domain/values/contracts.js';
import { ValueRules } from '../../domain/values/ValueRules.js';
import { ShapeFactory } from '../../domain/shapes/ShapeFactory.js';
import { EditorError } from '../errors/EditorError.js';
import { FrozenValue } from '../internal/FrozenValue.js';
import type { BoundCommand } from './BoundCommand.js';
import { CommandArguments } from './CommandArguments.js';
import { InitCommand } from './InitCommand.js';
import { HelpCommand } from './HelpCommand.js';
import { TreeCommand } from './TreeCommand.js';
import { ShowCommand } from './ShowCommand.js';
import { CreateCommand } from './CreateCommand.js';
import { MoveCommand } from './MoveCommand.js';
import { UndoCommand } from './UndoCommand.js';
import { RedoCommand } from './RedoCommand.js';
import { DeleteCommand } from './DeleteCommand.js';
import { ScaleCommand } from './ScaleCommand.js';
import { SetCommand } from './SetCommand.js';
import { GroupCommand } from './GroupCommand.js';
import { UngroupCommand } from './UngroupCommand.js';
import { AddToCommand } from './AddToCommand.js';
import { FrontCommand } from './FrontCommand.js';
import { BackCommand } from './BackCommand.js';
import { CanvasCommand } from './CanvasCommand.js';
import { ReadCommand } from './ReadCommand.js';
import { SaveCommand } from './SaveCommand.js';
interface Definition {
  readonly help: CommandHelp;
  readonly fields: readonly string[];
  parse(args: CommandArguments): CommandRequest;
  bind(request: CommandRequest): BoundCommand;
}
export class CommandCatalog implements CommandParser {
  readonly #definitions = new Map<string, Definition>();
  readonly #rules: ValueRules;
  readonly #factory = new ShapeFactory();
  constructor(limits: ResourceLimits) {
    this.#rules = new ValueRules(limits);
    this.add<Extract<CommandRequest, { command: 'read' }>>(
      'read',
      'read <file.svg>',
      'Read strict SVG',
      ['path'],
      (a) => {
        a.expect(1);
        return { command: 'read', path: a.value(0) };
      },
      (r) => {
        if (typeof r.path !== 'string') throw new EditorError('INVALID_VALUE');
        return new ReadCommand(r.path);
      },
    );
    this.add<Extract<CommandRequest, { command: 'save' }>>(
      'save',
      'save [file.svg]',
      'Save current document',
      ['path'],
      (a) => {
        a.expect(0, 1);
        return { command: 'save', ...(a.tokens.length ? { path: a.value(0) } : {}) };
      },
      (r) => {
        if (r.path !== undefined && typeof r.path !== 'string')
          throw new EditorError('INVALID_VALUE');
        return new SaveCommand(r.path);
      },
    );
    this.add<{ command: 'delete'; id: string }>(
      'delete',
      'delete <id>',
      'Delete subtree',
      ['id'],
      (a) => {
        a.expect(1);
        return { command: 'delete', id: a.id(0) };
      },
      (r) => new DeleteCommand(this.#rules.id(r.id)),
    );
    this.add<Extract<CommandRequest, { command: 'scale' }>>(
      'scale',
      'scale <id> <factor>',
      'Scale from origin',
      ['id', 'factor'],
      (a) => {
        a.expect(2);
        return { command: 'scale', id: a.id(0), factor: a.number(1) };
      },
      (r) =>
        new ScaleCommand(this.#rules.id(r.id), this.#rules.number(r.factor, 'positive', 'factor')),
    );
    this.add<Extract<CommandRequest, { command: 'set' }>>(
      'set',
      'set <id> <attr> <value>',
      'Set own property',
      ['id', 'attribute', 'value'],
      (a) => {
        a.expect(3);
        return { command: 'set', id: a.id(0), attribute: a.value(1), value: a.value(2) };
      },
      (r) => {
        if (typeof r.value !== 'string' && typeof r.value !== 'number')
          throw new EditorError('INVALID_VALUE');
        return new SetCommand(this.#rules.id(r.id), this.#rules.attribute(r.attribute), r.value);
      },
    );
    this.add<Extract<CommandRequest, { command: 'group' }>>(
      'group',
      'group <newGid> <id1> <id2>...',
      'Group in original document order',
      ['newId', 'ids'],
      (a) => {
        a.expect(3, Infinity);
        return {
          command: 'group',
          newId: a.id(0),
          ids: a.tokens.slice(1).map((t) => this.#rules.id(t.value)),
        };
      },
      (r) => {
        if (!Array.isArray(r.ids) || r.ids.length < 2) throw new EditorError('INVALID_GROUP_SIZE');
        return new GroupCommand(
          this.#rules.id(r.newId),
          r.ids.map((id) => this.#rules.id(id)),
        );
      },
    );
    this.add<Extract<CommandRequest, { command: 'ungroup' }>>(
      'ungroup',
      'ungroup <gid>',
      'Promote children of nested group',
      ['id'],
      (a) => {
        a.expect(1);
        return { command: 'ungroup', id: a.id(0) };
      },
      (r) => new UngroupCommand(this.#rules.id(r.id)),
    );
    this.add<Extract<CommandRequest, { command: 'addto' }>>(
      'addto',
      'addto <gid> <id>',
      'Append to group',
      ['containerId', 'id'],
      (a) => {
        a.expect(2);
        return { command: 'addto', containerId: a.id(0), id: a.id(1) };
      },
      (r) => new AddToCommand(this.#rules.id(r.containerId), this.#rules.id(r.id)),
    );
    this.add<{ command: 'front'; id: string }>(
      'front',
      'front <id>',
      'Bring to sibling end',
      ['id'],
      (a) => {
        a.expect(1);
        return { command: 'front', id: a.id(0) };
      },
      (r) => new FrontCommand(this.#rules.id(r.id)),
    );
    this.add<{ command: 'back'; id: string }>(
      'back',
      'back <id>',
      'Send to sibling beginning',
      ['id'],
      (a) => {
        a.expect(1);
        return { command: 'back', id: a.id(0) };
      },
      (r) => new BackCommand(this.#rules.id(r.id)),
    );
    this.add<Extract<CommandRequest, { command: 'canvas' }>>(
      'canvas',
      'canvas [w] [h]',
      'Canvas size/query',
      ['size'],
      (a) => {
        a.expect(0, 2);
        if (a.tokens.length === 1) throw new EditorError('SYNTAX_ERROR');
        return {
          command: 'canvas',
          ...(a.tokens.length ? { size: { width: a.number(0), height: a.number(1) } } : {}),
        };
      },
      (r) => new CanvasCommand(r.size === undefined ? undefined : this.#rules.size(r.size)),
    );
    this.add<Extract<CommandRequest, { command: 'init' }>>(
      'init',
      'init [w] [h]',
      'New canvas',
      ['size'],
      (a) => {
        a.expect(0, 2);
        if (a.tokens.length === 1) throw new EditorError('SYNTAX_ERROR');
        return {
          command: 'init',
          ...(a.tokens.length ? { size: { width: a.number(0), height: a.number(1) } } : {}),
        };
      },
      (r) => new InitCommand(this.#rules.size(r.size ?? { width: 800, height: 600 })),
    );
    this.add(
      'help',
      'help',
      'Commands',
      [],
      (a) => {
        a.expect(0);
        return { command: 'help' };
      },
      () => new HelpCommand(),
    );
    this.add<Extract<CommandRequest, { command: 'tree' }>>(
      'tree',
      'tree [id]',
      'Ordered structure',
      ['id'],
      (a) => {
        a.expect(0, 1);
        return { command: 'tree', ...(a.tokens.length ? { id: a.id(0) } : {}) };
      },
      (r) => new TreeCommand(r.id === undefined ? undefined : this.#rules.id(r.id)),
    );
    this.add<Extract<CommandRequest, { command: 'show' }>>(
      'show',
      'show <id>',
      'Own properties',
      ['id'],
      (a) => {
        a.expect(1);
        return { command: 'show', id: a.id(0) };
      },
      (r) => new ShowCommand(this.#rules.id(r.id)),
    );
    this.add<Extract<CommandRequest, { command: 'create' }>>(
      'create',
      'create <type> <id> [params...] [in <containerId>]',
      'Create shape',
      ['shape', 'parentId'],
      (a) => this.parseCreate(a),
      (r) =>
        new CreateCommand(
          this.#factory.validateCreation(r.shape, this.#rules),
          r.parentId === undefined ? undefined : this.#rules.id(r.parentId),
        ),
    );
    this.add<Extract<CommandRequest, { command: 'move' }>>(
      'move',
      'move <id> <dx> <dy>',
      'Translate',
      ['id', 'dx', 'dy'],
      (a) => {
        a.expect(3);
        return { command: 'move', id: a.id(0), dx: a.number(1), dy: a.number(2) };
      },
      (r) =>
        new MoveCommand(this.#rules.id(r.id), this.#rules.number(r.dx), this.#rules.number(r.dy)),
    );
    this.add(
      'undo',
      'undo',
      'Undo edit',
      [],
      (a) => {
        a.expect(0);
        return { command: 'undo' };
      },
      () => new UndoCommand(),
    );
    this.add(
      'redo',
      'redo',
      'Redo edit',
      [],
      (a) => {
        a.expect(0);
        return { command: 'redo' };
      },
      () => new RedoCommand(),
    );
  }
  private add<T extends CommandRequest>(
    name: string,
    syntax: string,
    description: string,
    fields: readonly string[],
    parse: (args: CommandArguments) => CommandRequest,
    bind: (request: T) => BoundCommand,
  ): void {
    this.#definitions.set(
      name,
      Object.freeze({
        help: Object.freeze({ name, syntax, description }),
        fields: Object.freeze([...fields]),
        parse,
        bind: (r: CommandRequest) => bind(r as T),
      }),
    );
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
    const definition = this.definition(request.command);
    if (Object.keys(request).some((key) => key !== 'command' && !definition.fields.includes(key)))
      throw new EditorError('SYNTAX_ERROR');
    return definition.bind(request);
  }
  describe(): readonly CommandHelp[] {
    return Object.freeze([...this.#definitions.values()].map((d) => d.help));
  }
  private definition(name: string): Definition {
    const definition = this.#definitions.get(name);
    if (!definition) throw new EditorError('UNKNOWN_COMMAND', { command: name });
    return definition;
  }
  private parseCreate(args: CommandArguments): CommandRequest {
    const type = args.value(0);
    const schema = this.#factory.definition(type).schema;
    let tokens = args.tokens;
    let parentId: string | undefined;
    if (
      tokens.length >= 4 &&
      tokens[tokens.length - 2]!.value === 'in' &&
      !tokens[tokens.length - 2]!.quoted
    ) {
      parentId = this.#rules.id(tokens[tokens.length - 1]!.value);
      tokens = tokens.slice(0, -2);
    }
    const a = new CommandArguments(tokens, this.#rules);
    const count = 2 + schema.creationFields.length;
    a.expect(count, count + (schema.optionalPaint ? 1 : 0));
    const value: Record<string, string | number> = { type, id: a.id(1) };
    for (const [i, field] of schema.creationFields.entries())
      value[field] = field === 'text' ? a.value(i + 2) : a.number(i + 2);
    if (schema.optionalPaint && tokens.length > count) value[schema.optionalPaint] = a.value(count);
    const shape = this.#factory.validateCreation(value as unknown as ShapeCreation, this.#rules);
    return { command: 'create', shape, ...(parentId === undefined ? {} : { parentId }) };
  }
}
