import { expect, it } from 'vitest';
import type { TreeDecorator } from '../../src/application/contracts/TreeDecorator.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TextPresenter } from '../../src/cli/TextPresenter.js';
import { TestPorts } from '../helpers/TestPorts.js';

it('decorates root, subtrees and ordinary rows in order and isolates observer faults from successful saves', async () => {
  let broken = false,
    multiline = false;
  const first: TreeDecorator = {
    name: 'observer',
    checkpoint: () => {
      if (broken) throw Error('fixture');
    },
    prepare: () => (row) => (multiline ? 'bad\nlabel' : row ? row.shape.id : 'root'),
  };
  const second: TreeDecorator = { name: 'tag', prepare: () => () => '(tag)' };
  const ports = new TestPorts(),
    commands = new CommandCatalog(defaultLimits);
  const session = new EditorSession({
    files: ports,
    codec: { decode: ports.decode.bind(ports), encode: () => '<fixture/>' },
    commands,
    limits: defaultLimits,
    decorators: [first, second],
  });
  const parser = new CliParser(commands),
    presenter = new TextPresenter();
  const run = async (s: string) => presenter.render(await session.execute(parser.parse(s)!));
  await run('init');
  await run('create g svg');
  expect((await run('tree')).stdout).toBe('svg (800x600) root (tag)\n└── g#svg svg (tag)\n');
  expect((await run('tree svg')).stdout).toBe('g#svg svg (tag)\n');
  multiline = true;
  expect(await run('tree')).toEqual({
    stdout: '',
    stderr: 'error: tree decorator failed: observer\n',
  });
  multiline = false;
  broken = true;
  expect((await run('save x.svg')).stderr).toBe('');
  expect(ports.files.get('/test/x.svg')).toBe('<fixture/>');
  expect((await run('tree')).stderr).toContain('decorator failed: observer');
  broken = false;
  await run('save');
  expect((await run('tree')).stderr).toBe('');
});
