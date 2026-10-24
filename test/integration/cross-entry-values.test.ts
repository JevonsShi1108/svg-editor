import { it, expect } from 'vitest';
import { ioFixture } from '../helpers/io-session.js';
import { committed, semantic } from '../helpers/session.js';
import { edit } from '../helpers/edit.js';
import { SvgDocumentBuilder } from '../../src/domain/document/SvgDocumentBuilder.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { CliParser } from '../../src/cli/CliParser.js';
import type { CommandRequest, ExecutionResult } from '../../src/application/contracts/api.js';
import type { ShapeCreation } from '../../src/domain/values/contracts.js';
interface NumberCase {
  raw: string;
  api: unknown;
  expected?: number;
}
// Handwritten expected values, from CFG-03/04 and TEST VAL tables. No production
// validator, parser, factory metadata or Codec is used to calculate an expectation.
const coordinates: readonly NumberCase[] = [
  { raw: '0', api: 0, expected: 0 },
  { raw: '-0', api: -0, expected: 0 },
  { raw: '-2.5', api: -2.5, expected: -2.5 },
  { raw: '+1.25e2', api: 125, expected: 125 },
  { raw: ' 1 ', api: 1, expected: 1 },
  { raw: '5e-324', api: Number.MIN_VALUE, expected: Number.MIN_VALUE },
  { raw: '1.7976931348623157e308', api: Number.MAX_VALUE, expected: Number.MAX_VALUE },
  { raw: '10oops', api: '10oops' },
  { raw: 'NaN', api: NaN },
  { raw: 'Infinity', api: Infinity },
  { raw: '-Infinity', api: -Infinity },
  { raw: '', api: '' },
  { raw: '0x10', api: '0x10' },
  { raw: '1e', api: '1e' },
  { raw: '1e-400', api: '1e-400' },
];
const nonnegative: readonly NumberCase[] = [
  ...coordinates.filter((r) => r.expected === undefined || r.expected >= 0),
  { raw: '-1', api: -1 },
];
const positive: readonly NumberCase[] = [
  ...coordinates.filter((r) => r.expected === undefined || r.expected > 0),
  { raw: '0', api: 0 },
  { raw: '-0', api: -0 },
  { raw: '-1', api: -1 },
];
const quote = (s: string) => `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
const xml = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\r', '&#13;');
const ready = async () => {
  const h = ioFixture();
  committed(await h.session.execute({ command: 'read', path: 'a.svg' }));
  committed(await h.session.execute({ command: 'create', shape: { type: 'g', id: 'g' } }));
  committed(
    await h.session.execute({
      command: 'create',
      shape: { type: 'text', id: 't', x: 0, y: 0, text: 'before' },
    }),
  );
  committed(await h.session.execute({ command: 'move', id: 'r1', dx: 1, dy: 0 }));
  committed(await h.session.execute({ command: 'undo' }));
  return h;
};
type Fixture = Awaited<ReturnType<typeof ready>>;
const exercise = async (
  valid: boolean,
  attempt: (h: Fixture) => Promise<ExecutionResult | null>,
  verify?: (h: Fixture) => Promise<void>,
) => {
  const h = await ready(),
    before = await semantic(h.session),
    status = (await h.session.execute({ command: 'tree' })).status;
  const result = await attempt(h);
  expect(result?.ok ?? false).toBe(valid);
  if (!valid) {
    expect((await h.session.execute({ command: 'tree' })).status).toEqual(status);
    expect(await semantic(h.session)).toEqual(before);
    expect(h.files.writeCalls).toEqual([]);
    committed(await h.session.execute({ command: 'redo' }));
  } else if (verify) await verify(h);
};
const cli = (h: Fixture, line: string) => {
  let request: CommandRequest | null;
  try {
    request = new CliParser(h.catalog).parse(line);
  } catch {
    return Promise.resolve(null);
  }
  return h.session.execute(request!);
};
const attribute = async (h: Fixture, id: string, field: string, expected: string | number) => {
  const result = committed(await h.session.execute({ command: 'show', id }));
  if (result.data.kind !== 'show') throw new Error('Expected show');
  expect(result.data.shape.attributes).toContainEqual({ name: field, value: expected });
};
for (const [id, field, rows] of [
  ['VAL-01', 'x', coordinates],
  ['VAL-02', 'width', nonnegative],
  ['VAL-04', 'stroke-width', nonnegative],
] as const)
  it.each(rows)(`${id} ${field} cross-entry value $raw`, async (row) => {
    const valid = row.expected !== undefined;
    const creation = (value: unknown) =>
      ({
        type: 'rect',
        id: 'r',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        [field]: value,
      }) as unknown as ShapeCreation;
    await exercise(
      valid,
      (h) =>
        h.session.execute(
          field === 'stroke-width'
            ? { command: 'set', id: 'r1', attribute: field, value: row.raw }
            : { command: 'create', shape: creation(row.api) },
        ),
      (h) => attribute(h, field === 'stroke-width' ? 'r1' : 'r', field, row.expected!),
    );
    await exercise(
      valid,
      (h) => h.session.execute({ command: 'set', id: 'r1', attribute: field, value: row.raw }),
      (h) => attribute(h, 'r1', field, row.expected!),
    );
    const args = field === 'x' ? `${quote(row.raw)} 0 1 1` : `0 0 ${quote(row.raw)} 1`;
    await exercise(
      valid,
      (h) =>
        cli(
          h,
          field === 'stroke-width'
            ? `set r1 stroke-width ${quote(row.raw)}`
            : `create rect r ${args}`,
        ),
      (h) => attribute(h, field === 'stroke-width' ? 'r1' : 'r', field, row.expected!),
    );
    const builder = new SvgDocumentBuilder(defaultLimits);
    builder.append('rect', 'r1', { attributes: { x: 0, y: 0, width: 1, height: 1 } });
    const doc = builder.build(),
      before = doc.describe();
    const direct = () =>
      edit(doc, (tx) =>
        field === 'stroke-width'
          ? doc.require('r1').set(tx, field, row.raw)
          : doc.create(tx, creation(row.api)),
      );
    if (valid) {
      direct();
      expect(
        doc.require(field === 'stroke-width' ? 'r1' : 'r').describe().attributes,
      ).toContainEqual({ name: field, value: row.expected });
    } else {
      expect(direct).toThrow();
      expect(doc.describe()).toEqual(before);
    }
    const attributes = { x: '0', y: '0', width: '1', height: '1', [field]: row.raw };
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect id="r" ${Object.entries(
      attributes,
    )
      .map(([k, v]) => `${k}="${xml(v)}"`)
      .join(' ')}/></svg>`;
    await exercise(
      valid,
      (h) => {
        h.files.files.set('/memory/value.svg', source);
        return h.session.execute({ command: 'read', path: 'value.svg' });
      },
      (h) => attribute(h, 'r', field, row.expected!),
    );
  });
it.each(positive)('VAL-02 canvas dimensions cross CLI/API/domain/SVG $raw', async (row) => {
  const valid = row.expected !== undefined,
    size = { width: row.api, height: 600 };
  for (const command of ['init', 'canvas'] as const) {
    await exercise(valid, (h) => h.session.execute({ command, size } as CommandRequest));
    await exercise(valid, (h) => cli(h, `${command} ${quote(row.raw)} 600`));
  }
  const builder = new SvgDocumentBuilder(defaultLimits),
    doc = builder.build(),
    before = doc.describe();
  const run = () =>
    edit(doc, (tx) => doc.resizeCanvas(tx, size as { width: number; height: number }));
  if (valid) {
    run();
    expect(doc.root.size.width).toBe(row.expected);
  } else {
    expect(run).toThrow();
    expect(doc.describe()).toEqual(before);
  }
  await exercise(valid, (h) => {
    h.files.files.set(
      '/memory/value.svg',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${xml(row.raw)}" height="600"/>`,
    );
    return h.session.execute({ command: 'read', path: 'value.svg' });
  });
});
it.each(positive)(
  'VAL-03 scale factor validates even empty groups across CLI/API/domain $raw',
  async (row) => {
    const valid = row.expected !== undefined;
    await exercise(valid, (h) =>
      h.session.execute({ command: 'scale', id: 'g', factor: row.api } as CommandRequest),
    );
    await exercise(valid, (h) => cli(h, `scale g ${quote(row.raw)}`));
    const builder = new SvgDocumentBuilder(defaultLimits),
      g = builder.append('g', 'g', { attributes: {} }),
      doc = builder.build(),
      before = doc.describe();
    const run = () => edit(doc, (tx) => g.scale(tx, row.api as number));
    if (valid) {
      run();
      expect(doc.describe()).toEqual(before);
    } else {
      expect(run).toThrow();
      expect(doc.describe()).toEqual(before);
    }
  },
);
it.each([
  ['RED', 'red'],
  ['#AbC', '#abc'],
  ['#AABBCC', '#aabbcc'],
  ['none', 'none'],
  ['aliceblue', 'aliceblue'],
  ['', null],
  ['transparent', null],
  ['currentColor', null],
  ['rgb(1,2,3)', null],
  ['url(http://example.invalid)', null],
  ['var(--paint)', null],
  ['#abcd', null],
] as const)('VAL-05 paint across CLI/API/domain/SVG %s', async (raw, expected) => {
  const valid = expected !== null;
  await exercise(valid, (h) =>
    h.session.execute({
      command: 'create',
      shape: { type: 'rect', id: 'r', x: 0, y: 0, width: 1, height: 1, fill: raw },
    }),
  );
  await exercise(
    valid,
    (h) => h.session.execute({ command: 'set', id: 'r1', attribute: 'fill', value: raw }),
    (h) => attribute(h, 'r1', 'fill', expected!),
  );
  await exercise(
    valid,
    (h) => cli(h, `create circle c 0 0 1 ${quote(raw)}`),
    (h) => attribute(h, 'c', 'fill', expected!),
  );
  const builder = new SvgDocumentBuilder(defaultLimits),
    g = builder.append('g', 'g', { attributes: {} }),
    doc = builder.build(),
    before = doc.describe();
  const run = () => edit(doc, (tx) => g.set(tx, 'fill', raw));
  if (valid) {
    run();
    expect(g.describe().attributes).toContainEqual({ name: 'fill', value: expected });
  } else {
    expect(run).toThrow();
    expect(doc.describe()).toEqual(before);
  }
  await exercise(
    valid,
    (h) => {
      h.files.files.set(
        '/memory/value.svg',
        `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><g id="g" fill="${xml(raw)}"/></svg>`,
      );
      return h.session.execute({ command: 'read', path: 'value.svg' });
    },
    (h) => attribute(h, 'g', 'fill', expected!),
  );
});
it.each([
  ['svg', true],
  ['in', true],
  ['R1', true],
  ['_a.b-9', true],
  ['', false],
  ['1a', false],
  [' a', false],
  ['a ', false],
  ['中文', false],
  ['a:b', false],
] as const)('VAL-06 ID across CLI/API/domain/SVG %s', async (id, valid) => {
  await exercise(valid, (h) => h.session.execute({ command: 'create', shape: { type: 'g', id } }));
  await exercise(valid, (h) => cli(h, `create g ${quote(id)}`));
  const builder = new SvgDocumentBuilder(defaultLimits),
    doc = builder.build(),
    before = doc.describe(),
    run = () => edit(doc, (tx) => doc.create(tx, { type: 'g', id }));
  if (valid) run();
  else {
    expect(run).toThrow();
    expect(doc.describe()).toEqual(before);
  }
  await exercise(valid, (h) => {
    h.files.files.set(
      '/memory/value.svg',
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><g id="${xml(id)}"/></svg>`,
    );
    return h.session.execute({ command: 'read', path: 'value.svg' });
  });
});
it.each([
  ['', true],
  [' a  中文🙂 &<> " ', true],
  ['&amp;', true],
  ['\r\n\t', true],
  ['\0', false],
  ['\u0001', false],
  ['\ud800', false],
  ['\udc00', false],
  ['\ufffe', false],
] as const)('VAL-06 XML text across applicable CLI/API/domain/SVG %j', async (text, valid) => {
  await exercise(valid, (h) =>
    h.session.execute({
      command: 'create',
      shape: { type: 'text', id: 'freshText', x: 0, y: 0, text },
    }),
  );
  await exercise(valid, (h) =>
    h.session.execute({ command: 'set', id: 't', attribute: 'text', value: text }),
  );
  if (!text.includes('\n') && !text.includes('\r'))
    await exercise(valid, (h) => cli(h, `create text freshText 0 0 ${quote(text)}`));
  const builder = new SvgDocumentBuilder(defaultLimits),
    doc = builder.build(),
    before = doc.describe(),
    run = () => edit(doc, (tx) => doc.create(tx, { type: 'text', id: 't', x: 0, y: 0, text }));
  if (valid) {
    run();
    expect(doc.require('t').describe().text).toBe(text);
  } else {
    expect(run).toThrow();
    expect(doc.describe()).toEqual(before);
  }
  await exercise(valid, (h) => {
    h.files.files.set(
      '/memory/value.svg',
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><text id="t">${xml(text)}</text></svg>`,
    );
    return h.session.execute({ command: 'read', path: 'value.svg' });
  });
});
