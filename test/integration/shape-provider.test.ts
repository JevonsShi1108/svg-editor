import { expect, it } from 'vitest';
import { ShapeRegistry } from '../../src/domain/shapes/ShapeRegistry.js';
import { builtinShapes } from '../../src/domain/shapes/builtin-shapes.js';
import { ContainerShape } from '../../src/domain/shapes/ContainerShape.js';
import { ShapeSchema } from '../../src/domain/shapes/ShapeSchema.js';
import type { ShapeProvider } from '../../src/domain/shapes/ShapeProvider.js';
import type { OwnState, DocumentId } from '../../src/domain/values/contracts.js';
import type { ValueRules } from '../../src/domain/values/ValueRules.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { CliParser } from '../../src/cli/CliParser.js';
import { TestPorts } from '../helpers/TestPorts.js';
import { committed, semantic } from '../helpers/session.js';

const schema = new ShapeSchema('stamp', {}, [], 'container', [], undefined, true);
class Stamp extends ContainerShape {
  constructor(id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    super(id, owner, rules, schema, state);
  }
}
const stamp: ShapeProvider = {
  name: 'stamp',
  schema,
  parameters: { tone: 'text' },
  xmlTag: 'g',
  dataKind: 'stamp',
  plan: (id, fields) => ({
    type: 'stamp',
    id,
    state: { attributes: { fill: fields.tone!, 'data-kind': 'stamp' } },
  }),
  construct: (...args) => new Stamp(...args),
};
it('uses the same provider from CLI fields through creation, XML write/read and missing-provider fallback', async () => {
  const shapes = new ShapeRegistry([...builtinShapes, stamp]);
  const files = new TestPorts();
  const commands = new CommandCatalog(defaultLimits, shapes);
  const codec = new XmlSvgCodec(shapes);
  const session = new EditorSession({ shapes, commands, files, codec, limits: defaultLimits });
  const parser = new CliParser(commands);
  for (const line of ['init', 'create stamp s red', 'save palette.svg', 'read palette.svg']) {
    committed(await session.execute(parser.parse(line)!));
  }
  const serialized = files.files.get('/test/palette.svg')!;
  expect(serialized).toContain('<g id="s" data-kind="stamp" fill="red"/>');
  expect((await semantic(session)).children[0]?.shape.type).toBe('stamp');
  expect(
    new XmlSvgCodec().decode(serialized, defaultLimits).document.require('s').schema.type,
  ).toBe('g');
});

it('omits individual builtins and rejects duplicate names or XML mappings', () => {
  const limited = new ShapeRegistry(builtinShapes.filter((p) => p.name !== 'circle'));
  const parser = new CliParser(new CommandCatalog(defaultLimits, limited));
  expect(parser.parse('create rect r 0 0 1 2')).toBeTruthy();
  expect(() => parser.parse('create circle c 0 0 1')).toThrow('UNKNOWN_SHAPE_TYPE');
  expect(() => new ShapeRegistry([...builtinShapes, stamp, stamp])).toThrow(
    'DUPLICATE_REGISTRATION',
  );
  expect(
    () =>
      new ShapeRegistry([
        ...builtinShapes,
        { ...stamp, dataKind: undefined } as unknown as ShapeProvider,
      ]),
  ).toThrow('DUPLICATE_REGISTRATION');
});
