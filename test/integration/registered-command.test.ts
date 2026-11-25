import { expect, it } from 'vitest';
import type { Command } from '../../src/application/contracts/Command.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { PluginCommandBinding } from '../../src/application/commands/PluginCommandBinding.js';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { ShapeFactory } from '../../src/domain/shapes/ShapeFactory.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TextPresenter } from '../../src/cli/TextPresenter.js';
import { Deferred } from '../helpers/Deferred.js';
import { TestPorts } from '../helpers/TestPorts.js';

it('awaits an independent registered query before the next command, including backend failure', async () => {
  const gate = new Deferred<void>(),
    started = new Deferred<void>();
  let fail = false;
  const command: Command = {
    help: { name: 'probe', syntax: 'probe', description: 'Test query' },
    arity: [0, 0],
    requiresDocument: false,
    async run(context) {
      expect(context.document).toBeNull();
      started.resolve();
      await gate.promise;
      if (fail) throw new Error('fixture');
      return ['a\nb'];
    },
  };
  const shapes = new ShapeFactory(),
    ports = new TestPorts();
  const commands = new CommandCatalog(defaultLimits, shapes, [
    new PluginCommandBinding(command, shapes),
  ]);
  const session = new EditorSession({
    commands,
    shapes,
    files: ports,
    codec: ports,
    limits: defaultLimits,
  });
  const parser = new CliParser(commands),
    presenter = new TextPresenter();
  const run = (line: string) => session.execute(parser.parse(line)!);
  expect(() => parser.parse('probe x')).toThrow('SYNTAX_ERROR');
  const query = run('probe');
  await started.promise;
  let ran = false;
  const init = run('init').then((r) => {
    ran = true;
    return r;
  });
  await Promise.resolve();
  expect(ran).toBe(false);
  gate.resolve();
  expect(presenter.render(await query).stdout).toBe('a\\nb\n');
  expect((await init).ok).toBe(true);
  const status = (await run('tree')).status;
  fail = true;
  expect(await run('probe')).toMatchObject({ ok: false, status });
  expect(await run('help')).toMatchObject({ ok: true, status });
  for (const name of ['stats', 'dir']) {
    try {
      parser.parse(name);
      throw Error('expected unknown command');
    } catch (error) {
      expect(
        presenter.diagnostic(
          (error as { diagnostic: { code: string; parameters: Record<string, string> } })
            .diagnostic,
        ),
      ).toBe('error: unknown command: ' + name + '\n');
    }
  }
});
