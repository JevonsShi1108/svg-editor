import { createInterface } from 'node:readline';
import { EditorSession } from './application/session/EditorSession.js';
import { CommandCatalog } from './application/commands/CommandCatalog.js';
import { XmlSvgCodec } from './infrastructure/svg/XmlSvgCodec.js';
import { NodeFileStore } from './infrastructure/files/NodeFileStore.js';
import { ShapeFactory } from './domain/shapes/ShapeFactory.js';
import { defaultLimits } from './domain/values/defaultLimits.js';
import { CliParser } from './cli/CliParser.js';
import { CliRepl } from './cli/CliRepl.js';
import { NodeTerminal } from './cli/NodeTerminal.js';
const terminal = new NodeTerminal(
  process.stdout,
  process.stderr,
  Boolean(process.stdin.isTTY && process.stdout.isTTY),
);
const shapes = new ShapeFactory();
const catalog = new CommandCatalog(defaultLimits, shapes);
const session = new EditorSession({
  commands: catalog,
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
