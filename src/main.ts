import { createInterface } from 'node:readline';
import { EditorSession } from './application/session/EditorSession.js';
import { CommandCatalog } from './application/commands/CommandCatalog.js';
import { XmlSvgCodec } from './infrastructure/svg/XmlSvgCodec.js';
import { NodeFileStore } from './infrastructure/files/NodeFileStore.js';
import { ShapeRegistry } from './domain/shapes/ShapeRegistry.js';
import { builtinShapes } from './domain/shapes/builtin-shapes.js';
import { PluginHost } from './host/loader/PluginHost.js';
import { ConfigLoader } from './host/loader/ConfigLoader.js';
import { PluginCommandBinding } from './application/commands/PluginCommandBinding.js';
import { AttributeDispatch } from './application/commands/AttributeDispatch.js';
import { TextPresenter } from './cli/TextPresenter.js';
import { defaultLimits } from './domain/values/defaultLimits.js';
import { CliParser } from './cli/CliParser.js';
import { CliRepl } from './cli/CliRepl.js';
import { NodeTerminal } from './cli/NodeTerminal.js';
const terminal = new NodeTerminal(
  process.stdout,
  process.stderr,
  Boolean(process.stdin.isTTY && process.stdout.isTTY),
);
const host = new PluginHost(
  process.cwd(),
  builtinShapes,
  new CommandCatalog(defaultLimits).describe().map((command) => command.name),
);
const argv = process.argv.slice(2);
const diagnostics =
  argv.length === 0 || (argv.length === 2 && argv[0] === '--preset' && argv[1] === 'base')
    ? []
    : argv.length === 2 && argv[0] === '--preset'
      ? await (await import('./host/code-profile.js')).loadCodeProfile(argv[1]!, host)
      : argv.length === 2 && argv[0] === '--config'
        ? await new ConfigLoader(host).load(argv[1]!)
        : ['invalid plugin config'];
const presenter = new TextPresenter();
for (const message of diagnostics)
  await terminal.stderr('error: ' + presenter.safe(message) + '\n');
const plugins = host.registrations;
const shapes = new ShapeRegistry([...builtinShapes, ...plugins.shapes]);
const catalog = new CommandCatalog(
  defaultLimits,
  shapes,
  plugins.commands.map((command) => new PluginCommandBinding(command, shapes)),
  new AttributeDispatch(plugins.attributes),
);
const session = new EditorSession({
  commands: catalog,
  decorators: plugins.decorators,
  codec: new XmlSvgCodec(shapes),
  shapes,
  files: new NodeFileStore(process.cwd()),
  limits: defaultLimits,
});
const input = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
const iterator = input[Symbol.asyncIterator]();
try {
  process.exitCode = await new CliRepl(session, new CliParser(catalog)).run(
    { [Symbol.asyncIterator]: () => iterator },
    terminal,
  );
} catch {
  process.exitCode = 1;
  try {
    await terminal.stderr('error: terminal failure\n');
  } catch {
    /* output device unavailable */
  }
} finally {
  input.close();
}
