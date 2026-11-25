import { expect, it } from 'vitest';
import { ModifiedStar } from '../../plugins/tree-star/src/ModifiedStar.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TextPresenter } from '../../src/cli/TextPresenter.js';
import { ControlledFileStore } from '../helpers/ControlledFileStore.js';

it('advances the display baseline only after published read and confirmed save', async () => {
  const files = new ControlledFileStore(),
    commands = new CommandCatalog(defaultLimits);
  const session = new EditorSession({
    commands,
    files,
    codec: new XmlSvgCodec(),
    limits: defaultLimits,
    decorators: [new ModifiedStar()],
  });
  const parser = new CliParser(commands),
    presenter = new TextPresenter();
  const run = async (line: string) => presenter.render(await session.execute(parser.parse(line)!));
  await run('init');
  await run('create text t 1 2 A');
  const tree = async () => (await run('tree')).stdout;
  expect(await tree()).toContain('"A" *');
  await run('save x.svg');
  const clean = await tree();
  expect(clean).not.toContain('*');
  await run('set t text B');
  const dirty = await tree();
  expect(dirty).toContain('"B" *');
  await run('undo');
  expect(await tree()).toBe(clean);
  await run('redo');
  expect(await tree()).toBe(dirty);
  await run('set t text A');
  expect(await tree()).toBe(clean);
  await run('set t text C');
  files.outcome = 'not-committed';
  await run('save');
  expect(await tree()).toContain('"C" *');
  files.outcome = 'indeterminate';
  await run('save');
  expect(await tree()).toContain('"C" *');
  await run('read x.svg');
  expect(await tree()).toBe(clean);
  files.files.set(
    '/memory/repair.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"><g id="p"><text x="1" y="2">abc</text></g></svg>',
  );
  await run('read repair.svg');
  expect((await tree()).match(/\*/g)).toHaveLength(3);
});
