import { expect, it, describe, vi } from 'vitest';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { InvariantOracle } from '../helpers/InvariantOracle.js';
import { SemanticSnapshot } from '../helpers/SemanticSnapshot.js';
import { edit } from '../helpers/edit.js';
const codec = new XmlSvgCodec();
const svg = (body: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" ${attrs}>${body}</svg>`;
const rect = '<rect id="r" width="3" height="4"/>';
const decode = (source: string) => codec.decode(source, defaultLimits);
describe('M09 XML supported subset independent positive oracle', () => {
  it('CFG-09 geometry omission remains distinct across no-op, real move/set and exact replay', () => {
    const result = decode(
      svg(
        '<g id="g"><rect id="r" width="3" height="4"/><circle id="c" r="2"/><ellipse id="e" rx="2" ry="3"/><line id="l"/><text id="t"/></g>',
      ),
    );
    const doc = result.document;
    const before = doc.describe();
    expect(
      edit(doc, (tx) => {
        doc.require('g').move(tx, 0, 0);
        doc.require('g').scale(tx, 1);
      }).isEmpty,
    ).toBe(true);
    expect(doc.describe()).toEqual(before);
    const explicit = edit(doc, (tx) => doc.require('r').set(tx, 'x', 0));
    expect(explicit.size).toBe(1);
    edit(doc, (tx) => explicit.replay(tx, 'backward'));
    expect(doc.describe()).toEqual(before);
    const moved = edit(doc, (tx) => doc.require('g').move(tx, 5, -3));
    expect(doc.require('l').describe().attributes).toContainEqual({ name: 'x1', value: 5 });
    expect(doc.require('t').describe().attributes).toContainEqual({ name: 'y', value: -3 });
    edit(doc, (tx) => moved.replay(tx, 'backward'));
    expect(doc.describe()).toEqual(before);
    const scaled = edit(doc, (tx) => doc.require('g').scale(tx, 2));
    expect(
      doc
        .require('r')
        .describe()
        .attributes.some((a) => a.name === 'x'),
    ).toBe(false);
    expect(doc.require('l').describe().attributes).toEqual([]);
    edit(doc, (tx) => scaled.replay(tx, 'backward'));
    expect(doc.describe()).toEqual(before);
    InvariantOracle.check(doc);
  });
  it('XML-01/10/11/12 hand-written hierarchy / exact text / explicit presence', () => {
    const result = decode(
      svg(
        '<g id="g1" fill="red"><rect id="r1" x="1.25" y="-2" width="3" height="4"/><text id="t1" x="5" y="6">  A &amp; B &lt; C  </text></g>',
      ),
    );
    const document = result.document.describe();
    expect(document.size).toEqual({ width: 400, height: 300 });
    expect(document.children.map((n) => n.shape.id)).toEqual(['g1']);
    const group = document.children[0]!;
    expect(group.shape.attributes).toEqual([{ name: 'fill', value: 'red' }]);
    expect(group.children.map((n) => n.shape.id)).toEqual(['r1', 't1']);
    expect(
      Object.fromEntries(group.children[0]!.shape.attributes.map((a) => [a.name, a.value])),
    ).toEqual({ x: 1.25, y: -2, width: 3, height: 4 });
    expect(group.children[1]!.shape.text).toBe('  A & B < C  ');
    expect(group.children[1]!.shape.attributes.some((a) => a.name === 'fill')).toBe(false);
    expect(result.semanticRepair).toBe(false);
    expect(result.warnings).toEqual([]);
    InvariantOracle.check(result.document);
  });
  it('XML-02 namespaces normalize, all six types and root/g/leaf readonly attributes retained', () => {
    const source =
      '<s:svg xmlns:s="http://www.w3.org/2000/svg" xmlns:unused="urn:unused" width="400px" height="3e2" fill="BLUE" font-size="0px" text-anchor="start"><s:g id="g" data-kind="box" fill="red" font-size="16" text-anchor="middle"><s:rect id="r" width="0" height="4" font-size="1"/><s:text id="t">中文🙂</s:text><s:circle id="c" r="0"/><s:ellipse id="e" rx="1" ry="2"/><s:line id="l"/></s:g></s:svg>';
    const result = decode(source);
    expect(result.document.nodeCount).toBe(6);
    const desc = result.document.describe();
    expect(desc.attributes).toContainEqual({ name: 'fill', value: 'blue' });
    expect(desc.attributes).toContainEqual({ name: 'font-size', value: 0 });
    expect(desc.children[0]!.shape.attributes).toContainEqual({ name: 'data-kind', value: 'box' });
    expect(result.document.require('l').describe().attributes).toEqual([]);
    expect(
      result.document
        .require('r')
        .describe()
        .attributes.some((a) => a.name === 'x'),
    ).toBe(false);
    const output = codec.encode(desc);
    expect(output).not.toContain('s:');
    expect(output).not.toContain('xmlns:unused');
    expect(SemanticSnapshot.of(decode(output).document.describe())).toEqual(
      SemanticSnapshot.of(desc),
    );
    InvariantOracle.check(result.document);
  });
  it.each(['', 'viewBox="0 0 400 300"', 'viewBox="-0,+0,4e2,3e2"', 'viewBox=" 0 , 0 400, 300 "'])(
    'XML-04 canonical viewBox %s',
    (attrs) => {
      const result = decode(svg(rect, attrs));
      expect(result.semanticRepair).toBe(false);
      expect(codec.encode(result.document.describe())).toContain('viewBox="0 0 400 300"');
    },
  );
  it('XML-09/20 readonly metadata is plain Group, retained through edits/replay and nested ungroup', () => {
    const result = decode(
      svg(
        '<g id="p" fill="red"><g id="box" data-kind="box" font-size="16" text-anchor="middle"><rect id="r" width="3" height="4"/></g></g>',
        'stroke="blue" stroke-width="3" font-size="12" text-anchor="end"',
      ),
    );
    const doc = result.document;
    const before = doc.describe();
    const group = doc.require('box');
    expect(group.describe().type).toBe('g');
    expect(() => edit(doc, (tx) => group.set(tx, 'label', 'x'))).toThrow();
    const changed = edit(doc, (tx) => {
      group.set(tx, 'fill', 'green');
      group.move(tx, 5, 3);
    });
    edit(doc, (tx) => changed.replay(tx, 'backward'));
    expect(doc.describe()).toEqual(before);
    edit(doc, (tx) => doc.ungroup(tx, group));
    expect(doc.find('box')).toBeUndefined();
    expect(
      doc
        .require('r')
        .describe()
        .attributes.some((a) => a.name === 'fill'),
    ).toBe(false);
    InvariantOracle.check(doc);
  });
  it.each([
    ['A &amp; B &lt; C &gt; D', 'A & B < C > D'],
    ['&amp;amp;', '&amp;'],
    ['&#xD;\r\nX\rY\n', '\r\nX\nY\n'],
    ['<![CDATA[  < & DOCTYPE >  ]]>', '  < & DOCTYPE >  '],
    ['a<!-- ignored -->b<![CDATA[c]]>', 'abc'],
    ['', ''],
    [' \t中文🙂  ', ' \t中文🙂  '],
  ])('XML-12/13/19 decoded text %s', (raw, text) =>
    expect(
      decode(svg(`<text id="t">${raw}</text>`))
        .document.require('t')
        .describe().text,
    ).toBe(text),
  );
  it.each([
    '\uFEFF',
    '<?xml version="1.0"?>',
    '<?xml version="1.0" encoding="uTf-8" standalone="yes"?>',
    '\uFEFF<?xml version="1.0" encoding="UTF-8" standalone="no"?>',
  ])('XML-19/22 BOM/declaration %j', (prefix) =>
    expect(decode(prefix + svg(rect)).semanticRepair).toBe(false),
  );
  it('XML-24 decode/encode have no terminal/port side effects and old descriptions independent', () => {
    const warn = vi.spyOn(console, 'warn');
    const log = vi.spyOn(console, 'log');
    const result = decode(svg('<rect width="3" height="4"/>'));
    const desc = result.document.describe();
    const before = structuredClone(desc);
    codec.encode(desc);
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    warn.mockRestore();
    log.mockRestore();
    expect(desc).toEqual(before);
    expect(result.warnings).toHaveLength(1);
  });
});
describe('M09 strict XML / SEC deny table — no stripping unsupported input', () => {
  const bad = [
    '<svg width="400" height="300"/>',
    '<svg xmlns="urn:not-svg" width="400" height="300"/>',
    svg('<x:rect xmlns:x="urn:fake" width="3" height="4"/>'),
    ...[
      '1 0 400 300',
      '0 0 401 300',
      '0 0 400',
      '0 0 400 300 0',
      '0,,0,400,300',
      '0 0 400 300,',
      '0 0 400px 300',
      'NaN 0 400 300',
    ].map((v) => svg(rect, `viewBox="${v}"`)),
    ...['svg', 'g', 'rect'].map((tag) =>
      tag === 'svg'
        ? svg(rect, 'transform="translate(0,0)"')
        : svg(
            `<${tag} id="x" ${tag === 'rect' ? 'width="3" height="4"' : ''} transform="scale(1)"/>`,
          ),
    ),
    ...['path', 'use', 'image', 'defs', 'foreignObject', 'script', 'svg', 'polygon', 'box'].map(
      (tag) => svg(`<${tag} id="x"/>`),
    ),
    ...[
      'style="fill:red"',
      'class="x"',
      'filter="url(x)"',
      'clip-path="url(x)"',
      'mask="url(x)"',
      'href="virtual"',
      'onclick="alert(1)"',
      'data-extra="x"',
      'id="root"',
      'data-kind="box"',
    ].map((attr) => svg(rect, attr)),
    svg('<rect id="r" width="3" height="4" data-kind="box"/>'),
    svg('<text id="t"><tspan>A</tspan></text>'),
    svg('<text id="t"><textPath>A</textPath></text>'),
    svg('<rect id="r" width="3" height="4"><circle id="c" r="1"/></rect>'),
    svg('not layout text'),
    svg('\u00a0'),
    svg('<rect id="r" width="3" height="4">text</rect>'),
    svg('<![CDATA[ ]]>'),
    svg('<rect id="r" width="3" height="4">'),
    svg(rect) + svg(rect),
    svg('<rect id="r" id="r2" width="3" height="4"/>'),
    svg('<text id="t">&undefined;</text>'),
    svg(rect) + 'garbage',
    '<?xml version="1.1"?>' + svg(rect),
    '<?xml version="1.0" encoding="ISO-8859-1"?>' + svg(rect),
    '<?xml-stylesheet href="virtual"?>' + svg(rect),
    svg('<?other data?>' + rect),
    '\uFEFF\uFEFF' + svg(rect),
    '<!DOCTYPE svg>' + svg(rect),
    '<!DOCTYPE svg [<!ENTITY x "a">]>' + svg('<text>&x;</text>'),
    '<!DOCTYPE svg [<!ENTITY a "&b;"><!ENTITY b "&a;">]>' + svg(''),
    '<!DOCTYPE svg SYSTEM "http://virtual.invalid/no-network">' + svg(rect),
    '<!DOCTYPE svg [<!ENTITY e SYSTEM "file:///controlled-test-only">]>' + svg('<text>&e;</text>'),
    svg('<xi:include xmlns:xi="http://www.w3.org/2001/XInclude" href="virtual"/>'),
    svg('<rect xmlns:x="urn:fake" x:id="r" width="3" height="4"/>'),
    svg('<text id="t" xml:space="preserve">A</text>'),
    ...[
      'url(http://virtual.invalid)',
      'var(--x)',
      'rgb(0,0,0)',
      'transparent',
      'currentColor',
      '#abcd',
      '#aabbccdd',
    ].map((fill) => svg(`<rect id="r" width="3" height="4" fill="${fill}"/>`)),
    ...[
      '-1',
      'Infinity',
      'NaN',
      '10oops',
      '1e309',
      '1e-400',
      '1%',
      '1em',
      '1 PX',
      '1PX',
      '1 px',
    ].map((width) => svg(`<rect id="r" width="${width}" height="4"/>`)),
    svg('<rect id="r" height="4"/>'),
    svg('<circle id="c"/>'),
    svg('<ellipse id="e" rx="1"/>'),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"/>',
    ...['\0', '\u0001', '\ud800', '\udc00', '\ufffe', '&#0;', '&#xFFFF;'].map((text) =>
      svg(`<text id="t">${text}</text>`),
    ),
    svg('<g id="g" font-size="-1"/>'),
    svg('<text id="t" text-anchor="MIDDLE"/>'),
    svg('<g id="g" data-kind=" bad "/>'),
  ];
  it.each(bad.map((source, index) => [index, source] as const))(
    'XML-03/05—08/14/17—23 SEC-01—08 negative %s',
    (_index, source) => expect(() => decode(source)).toThrow(),
  );
  it('SEC-03 external declarations do not invoke network resolvers', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'));
    expect(() =>
      decode('<!DOCTYPE svg SYSTEM "http://virtual.invalid/no-network">' + svg(rect)),
    ).toThrow();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
    expect(
      decode(svg('<text id="t">DOCTYPE &amp; &#65;</text><!-- DOCTYPE as comment -->'))
        .document.require('t')
        .describe().text,
    ).toBe('DOCTYPE & A');
  });
});
describe('M09 ID two-pass deterministic repair', () => {
  it.each([
    ['<rect width="1" height="1"/><circle id="rect1" r="1"/>', ['rect2', 'rect1']],
    [
      '<rect width="1" height="1"/><rect id="rect1" width="1" height="1"/><rect width="1" height="1"/><rect id="rect3" width="1" height="1"/>',
      ['rect2', 'rect1', 'rect4', 'rect3'],
    ],
    [
      '<g><rect width="1" height="1"/><circle r="1"/></g><rect width="1" height="1"/>',
      ['g1', 'rect2'],
    ],
  ])('ID-01/02/03/04 %s', (body, ids) => {
    const result = decode(svg(body as string));
    expect(result.document.root.childrenSnapshot().map((n) => n.id)).toEqual(ids);
    expect(result.semanticRepair).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    if ((body as string).startsWith('<g>'))
      expect(result.warnings.map((w) => w.parameters.id)).toEqual([
        'g1',
        'rect1',
        'circle1',
        'rect2',
      ]);
    InvariantOracle.check(result.document);
  });
  it.each([
    '<g id="same"><rect id="same" width="1" height="1"/></g>',
    '<rect id="" width="1" height="1"/>',
    '<rect id=" bad" width="1" height="1"/>',
    '<rect id="中文" width="1" height="1"/>',
  ])('ID-05/08 explicit invalid is not anonymous %s', (body) =>
    expect(() => decode(svg(body))).toThrow(),
  );
  it('ID-06/07/09/10 warnings/counters local to candidate, IDs case sensitive', () => {
    const source = svg(
      '<rect width="1" height="1"/><rect id="r1" width="1" height="1"/><rect id="R1" width="1" height="1"/>',
    );
    const first = decode(source);
    expect(() => decode(svg('<rect width="1" height="1"/><circle r="-1"/>'))).toThrow();
    const next = decode(source);
    expect(next.warnings).toEqual(first.warnings);
    expect(SemanticSnapshot.of(next.document.describe())).toEqual(
      SemanticSnapshot.of(first.document.describe()),
    );
    const normalized = codec.encode(first.document.describe());
    expect(decode(normalized).semanticRepair).toBe(false);
    expect(decode(normalized).warnings).toEqual([]);
  });
});
describe('M09 LIM / CFG admission boundaries', () => {
  it('LIM-01 exact UTF-8 bytes include BOM and emoji', () => {
    const source = '\uFEFF' + svg('<text id="t">中文🙂</text>');
    const n = Buffer.byteLength(source);
    expect(n).toBeGreaterThan(source.length);
    for (const maxSvgBytes of [n, n + 1])
      expect(codec.decode(source, { ...defaultLimits, maxSvgBytes }).document.nodeCount).toBe(1);
    expect(() => codec.decode(source, { ...defaultLimits, maxSvgBytes: n - 1 })).toThrow(
      'RESOURCE_LIMIT',
    );
  });
  it('LIM-02/04 final nodes and root=0 depth', () => {
    const source = svg('<g id="g"><rect id="r" width="1" height="1"/></g>');
    expect(
      codec.decode(source, { ...defaultLimits, maxNodeCount: 2, maxTreeDepth: 2 }).document
        .nodeCount,
    ).toBe(2);
    expect(() => codec.decode(source, { ...defaultLimits, maxNodeCount: 1 })).toThrow(
      'RESOURCE_LIMIT',
    );
    expect(() => codec.decode(source, { ...defaultLimits, maxTreeDepth: 1 })).toThrow(
      'RESOURCE_LIMIT',
    );
  });
  it('LIM-07 decoded text fragments accumulate Unicode scalar quota', () => {
    const source = svg('<text id="t">a<![CDATA[🙂]]><!-- gap -->b</text>');
    for (const maxTextLength of [3, 4])
      expect(
        codec
          .decode(source, { ...defaultLimits, maxTextLength })
          .document.require('t')
          .describe().text,
      ).toBe('a🙂b');
    expect(() => codec.decode(source, { ...defaultLimits, maxTextLength: 2 })).toThrow(
      'RESOURCE_LIMIT',
    );
  });
  it('LIM-08 decoded attribute length checked before normalization including namespace declarations', () => {
    for (const size of [39, 40])
      expect(
        codec.decode(svg(`<g id="${'a'.repeat(size)}"/>`), {
          ...defaultLimits,
          maxAttributeLength: 40,
        }).document.nodeCount,
      ).toBe(1);
    expect(() =>
      codec.decode(svg(`<g id="${'a'.repeat(41)}"/>`), {
        ...defaultLimits,
        maxAttributeLength: 40,
      }),
    ).toThrow('RESOURCE_LIMIT');
    expect(() =>
      codec.decode(svg(`<rect width="${' '.repeat(40)}1" height="1"/>`), {
        ...defaultLimits,
        maxAttributeLength: 40,
      }),
    ).toThrow('RESOURCE_LIMIT');
    expect(() => codec.decode(svg(rect), { ...defaultLimits, maxAttributeLength: 3 })).toThrow(
      'RESOURCE_LIMIT',
    );
  });
});
