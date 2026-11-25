import type {
  AttributeHandler,
  Command,
  Plugin,
  PluginContext,
  ShapeProvider,
  TreeDecorator,
} from '../../public.js';
import { ShapeRegistry } from '../../domain/shapes/ShapeRegistry.js';
import { FrozenValue } from '../../application/internal/FrozenValue.js';

const categories = ['shapes', 'commands', 'decorators', 'attributes'] as const;
type Category = (typeof categories)[number];
export type Contributions = Partial<Record<Category, readonly string[]>>;
export interface Manifest {
  readonly name: string;
  readonly contributes?: Contributions;
}
export interface Registrations {
  shapes: ShapeProvider[];
  commands: Command[];
  decorators: TreeDecorator[];
  attributes: AttributeHandler[];
}
const empty = (): Registrations => ({ shapes: [], commands: [], decorators: [], attributes: [] });
const names = (actual: Registrations, key: Category) =>
  key === 'commands' ? actual.commands.map((x) => x.help.name) : actual[key].map((x) => x.name);
function describe(contributions: Contributions) {
  return categories
    .flatMap((key) => [...(contributions[key] ?? [])].sort().map((name) => key + '/' + name))
    .join(', ');
}

export class PluginHost {
  #loaded = empty();
  constructor(
    readonly cwd: string,
    private readonly defaults: readonly ShapeProvider[],
    private readonly commandNames: readonly string[],
  ) {}
  get registrations(): Readonly<Registrations> {
    const { shapes, commands, decorators, attributes } = this.#loaded;
    return {
      shapes: [...shapes],
      commands: [...commands],
      decorators: [...decorators],
      attributes: [...attributes],
    };
  }

  async activate(
    plugin: Plugin,
    manifest: Manifest,
    options: Readonly<Record<string, unknown>> = {},
  ): Promise<string | undefined> {
    const initial = this.#loaded;
    const staged = empty();
    let open = true;
    let duplicate: string | undefined;
    const check = (key: Category, name: string) => {
      if (!open) throw new Error('registration closed');
      if (typeof name !== 'string' || !/^[a-zA-Z][\w.-]*$/.test(name))
        throw new Error('invalid registration name');
      const builtins =
        key === 'commands'
          ? this.commandNames
          : key === 'shapes'
            ? this.defaults.map((p) => p.name)
            : [];
      if ([...builtins, ...names(this.#loaded, key), ...names(staged, key)].includes(name)) {
        duplicate = 'duplicate registration: ' + key + '/' + name;
        throw new Error(duplicate);
      }
    };
    const context: PluginContext = {
      cwd: this.cwd,
      registerCommand: (command) => {
        check('commands', command.help.name);
        if (
          typeof command.run !== 'function' ||
          typeof command.help.syntax !== 'string' ||
          typeof command.help.description !== 'string' ||
          typeof command.requiresDocument !== 'boolean' ||
          !Array.isArray(command.arity) ||
          command.arity.length !== 2 ||
          !command.arity.every((n) => Number.isSafeInteger(n) && n >= 0) ||
          command.arity[0] > command.arity[1]
        )
          throw Error('invalid command');
        staged.commands.push(command);
      },
      registerShape: (shape) => {
        check('shapes', shape.name);
        if (typeof shape.plan !== 'function' || typeof shape.construct !== 'function')
          throw Error('invalid shape provider');
        staged.shapes.push(shape);
      },
      registerAttribute: (handler) => {
        check('attributes', handler.name);
        if (typeof handler.handles !== 'function' || typeof handler.apply !== 'function')
          throw Error('invalid attribute handler');
        staged.attributes.push(handler);
      },
      registerDecorator: (decorator) => {
        check('decorators', decorator.name);
        if (typeof decorator.prepare !== 'function') throw Error('invalid tree decorator');
        staged.decorators.push(decorator);
      },
    };
    try {
      const activation = plugin.activate(Object.freeze(context), FrozenValue.copy(options));
      if (activation !== undefined) await activation;
      open = false;
      if (duplicate) return duplicate;
      if (initial !== this.#loaded) {
        // Another activation may have published while this plugin awaited its options or resources.
        for (const key of categories) {
          const published = new Set(names(this.#loaded, key));
          const conflict = names(staged, key).find((name) => published.has(name));
          if (conflict) return 'duplicate registration: ' + key + '/' + conflict;
        }
      }
      const declared = manifest.contributes === undefined ? {} : manifest.contributes;
      const actual = Object.fromEntries(categories.map((key) => [key, names(staged, key)]));
      const valid =
        declared &&
        typeof declared === 'object' &&
        !Array.isArray(declared) &&
        Object.keys(declared).every((key) => categories.includes(key as Category)) &&
        categories.every(
          (key) =>
            declared[key] === undefined ||
            (Array.isArray(declared[key]) &&
              declared[key].every((n) => typeof n === 'string' && /^[a-zA-Z][\w.-]*$/.test(n))),
        );
      const advertised = valid ? describe(declared) : 'invalid';
      const registered = describe(actual);
      if (
        !valid ||
        categories.some((key) => {
          const expected = declared[key] ?? [];
          const contributed = names(staged, key);
          return (
            expected.length !== contributed.length ||
            new Set(expected).size !== expected.length ||
            contributed.some((name) => !expected.includes(name))
          );
        })
      )
        return `plugin manifest mismatch: ${manifest.name} (declared: ${advertised}, registered: ${registered})`;
      const joined = {
        shapes: [...this.#loaded.shapes, ...staged.shapes],
        commands: [...this.#loaded.commands, ...staged.commands],
        attributes: [...this.#loaded.attributes, ...staged.attributes],
        decorators: [...this.#loaded.decorators, ...staged.decorators],
      };
      if (staged.shapes.length) new ShapeRegistry([...this.defaults, ...joined.shapes]);
      this.#loaded = joined;
      return undefined;
    } catch (error) {
      return (
        duplicate ??
        `plugin failed to activate: ${manifest.name} (${error instanceof Error ? error.message : String(error)})`
      );
    } finally {
      open = false;
    }
  }
}
