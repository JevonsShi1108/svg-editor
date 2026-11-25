import { expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { BoxProvider } from '../../plugins/shape-box/src/BoxProvider.js';
import { BoxAttributes } from '../../plugins/shape-box/src/BoxAttributes.js';
import { ShapeRegistry } from '../../src/domain/shapes/ShapeRegistry.js';
import { builtinShapes } from '../../src/domain/shapes/builtin-shapes.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { AttributeDispatch } from '../../src/application/commands/AttributeDispatch.js';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TestPorts } from '../helpers/TestPorts.js';
import { committed, semantic } from '../helpers/session.js';

function fixture() {
  const shapes = new ShapeRegistry([...builtinShapes, new BoxProvider()]);
  const commands = new CommandCatalog(
    defaultLimits,
    shapes,
    [],
    new AttributeDispatch([new BoxAttributes()]),
  );
  const files = new TestPorts(),
    codec = new XmlSvgCodec(shapes),
    session = new EditorSession({ files, commands, codec, shapes, limits: defaultLimits });
  const parser = new CliParser(commands);
  return { run: (line: string) => session.execute(parser.parse(line)!), session, codec, files };
}
it('sets either owned part as one undo unit, nests and moves entire boxes, and protects compulsory children', async () => {
  const { run, session } = fixture();
  for (const line of ['init', 'create box a 10 20 150 60 "A"', 'create box b 2 3 40 20 "B" in a'])
    committed(await run(line));
  const original = await semantic(session);
  for (const line of [
    'move a 4 5',
    'scale a 2',
    'set a label new',
    'set a fill blue',
    'delete a',
  ]) {
    committed(await run(line));
    const after = await semantic(session);
    expect(after).not.toEqual(original);
    committed(await run('undo'));
    expect(await semantic(session)).toEqual(original);
    committed(await run('redo'));
    expect(await semantic(session)).toEqual(after);
    committed(await run('undo'));
  }
  for (const line of [
    'delete a-rect',
    'addto b a-label',
    'move a-label 0 2',
    'scale a-rect 2',
    'set a-rect width 4',
    'front a-rect',
    'back a-label',
    'group bad a-label b',
    'ungroup a',
    'ungroup b',
  ]) {
    const before = (await run('tree')).status;
    expect(await run(line)).toMatchObject({ ok: false, status: before });
    expect(await semantic(session)).toEqual(original);
  }
  committed(await run('set a label "新 & <x>"'));
  committed(await run('set a fill #f5a623'));
  const tree = await semantic(session),
    children = tree.children[0]!.children;
  expect(children[0]!.shape.attributes).toContainEqual({ name: 'fill', value: '#f5a623' });
  expect(children[1]!.shape.text).toBe('新 & <x>');
});
it('round-trips marked groups, rejects bad parts and duplicate ids without publishing a damaged candidate', async () => {
  const { run, session, files } = fixture();
  for (const line of ['init', 'create box a 2 3 40 20 "A & B"', 'save x.svg'])
    committed(await run(line));
  const xml = files.files.get('/test/x.svg')!;
  const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml'),
    g = parsed.getElementsByTagName('g')[0]!;
  expect(g.getAttribute('data-kind')).toBe('box');
  expect(g.getElementsByTagName('text')[0]!.textContent).toBe('A & B');
  const plain = new XmlSvgCodec().decode(xml, defaultLimits).document.describe();
  expect(plain.children[0]!.shape.type).toBe('g');
  expect(plain.children[0]!.children.map((n) => n.shape.id)).toEqual(['a-rect', 'a-label']);
  committed(await run('read x.svg'));
  committed(await run('set a label after'));
  const before = await semantic(session),
    status = (await run('tree')).status;
  for (const [bad, code] of [
    [xml.replace('id="a-rect"', 'id="missing"'), 'INVALID_COMPOSITE'],
    [xml.replace(/<text .*?<\/text>/, '<g id="a-label"/>'), 'INVALID_COMPOSITE'],
    [xml.replace('id="a-label"', 'id="a-rect"'), 'DUPLICATE_ID'],
  ] as const) {
    files.files.set('/test/bad.svg', bad);
    expect(await run('read bad.svg')).toMatchObject({ ok: false, error: { code }, status });
    expect(await semantic(session)).toEqual(before);
    if (code === 'DUPLICATE_ID')
      expect(() => new XmlSvgCodec().decode(bad, defaultLimits)).toThrow('DUPLICATE_ID');
  }
  for (const id of ['c-rect', 'd-label']) committed(await run('create g ' + id));
  for (const id of ['c', 'd'])
    expect(await run('create box ' + id + ' 0 0 1 2 X')).toMatchObject({
      ok: false,
      error: { code: 'DUPLICATE_ID' },
    });
});
