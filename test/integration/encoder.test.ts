import { expect, it, describe } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import { XmlSvgEncoder } from '../../src/infrastructure/svg/XmlSvgEncoder.js';
import { SvgDocumentBuilder } from '../../src/domain/document/SvgDocumentBuilder.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { edit } from '../helpers/edit.js';
const parse = (source: string) =>
  new DOMParser({
    onError: (level, message) => {
      throw new Error(`${level}: ${message}`);
    },
  }).parseFromString(source, 'application/xml');
const encodeText = (text: string) => {
  const builder = new SvgDocumentBuilder(defaultLimits);
  builder.append('text', 't', { attributes: { x: 1, y: 2 }, text });
  return new XmlSvgEncoder().encode(builder.build().describe());
};
describe('M08 XML-09—16/24 encoder independently checked with xmldom, no production decoder', () => {
  it('six tags, root/g/leaf retained attributes, order, omission and metadata survive encoding', () => {
    const builder = new SvgDocumentBuilder(
      defaultLimits,
      { width: 400, height: 300 },
      { fill: 'blue', 'font-size': 18, 'text-anchor': 'start' },
    );
    const group = builder.append('g', 'g1', {
      attributes: {
        fill: 'red',
        'stroke-width': 3,
        'font-size': 16,
        'text-anchor': 'middle',
        'data-kind': 'box',
      },
    });
    builder.append(
      'rect',
      'r',
      { attributes: { width: 3, height: 4, 'font-size': 0 } },
      group.asContainer()!,
    );
    builder.append(
      'text',
      't',
      { attributes: { x: 5, y: 6, fill: 'black' }, text: '  A & B < C  ' },
      group.asContainer()!,
    );
    builder.append('circle', 'c', { attributes: { cx: 1, cy: 2, r: 0 } });
    builder.append('ellipse', 'e', { attributes: { rx: 0.3, ry: 0.4 } });
    builder.append('line', 'l', { attributes: { x1: -1, x2: 5, stroke: 'none' } });
    const doc = builder.build();
    const description = doc.describe();
    const old = structuredClone(description);
    const encoded = new XmlSvgEncoder().encode(description);
    const parsed = parse(encoded);
    const root = parsed.documentElement!;
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(root.getAttribute('width')).toBe('400');
    expect(root.getAttribute('height')).toBe('300');
    expect(root.getAttribute('viewBox')).toBe('0 0 400 300');
    expect(root.getAttribute('fill')).toBe('blue');
    expect(root.getAttribute('font-size')).toBe('18');
    expect(root.getAttribute('text-anchor')).toBe('start');
    expect(
      Array.from(root.childNodes)
        .filter((n) => n.nodeType === 1)
        .map((n) => n.nodeName),
    ).toEqual(['g', 'circle', 'ellipse', 'line']);
    const g = parsed.getElementsByTagName('g').item(0)!;
    expect(g.getAttribute('data-kind')).toBe('box');
    expect(g.getAttribute('font-size')).toBe('16');
    expect(g.getAttribute('text-anchor')).toBe('middle');
    expect(g.getAttribute('stroke-width')).toBe('3');
    const rect = parsed.getElementsByTagName('rect').item(0)!;
    expect(rect.hasAttribute('x')).toBe(false);
    expect(rect.hasAttribute('fill')).toBe(false);
    expect(rect.getAttribute('font-size')).toBe('0');
    expect(parsed.getElementsByTagName('text').item(0)!.textContent).toBe('  A & B < C  ');
    expect(parsed.getElementsByTagName('circle').item(0)!.hasAttribute('stroke')).toBe(false);
    expect(description).toEqual(old);
    edit(doc, (tx) => doc.require('r').move(tx, 2, 0));
    edit(doc, (tx) => doc.require('g1').scale(tx, 2));
    expect(description).toEqual(old);
    expect(new XmlSvgEncoder().encode(description)).toBe(encoded);
  });
  it.each([
    '',
    '  中文🙂  ',
    'A & B < C > D',
    '&amp; &lt; literal entities',
    '"double" and \'single\'',
    '\r',
    '\n',
    '\r\n',
    '\t',
    'a\r\nb\tc',
    '\u{10000}\u{10ffff}',
  ])('XML-12/13/16 exact text %j', (text) => {
    const encoded = encodeText(text);
    const parsed = parse(encoded);
    expect(parsed.getElementsByTagName('text').item(0)!.textContent).toBe(text);
    if (text.includes('\r')) expect(encoded).toContain('&#xD;');
    if (text === '&amp; &lt; literal entities') expect(encoded).toContain('&amp;amp; &amp;lt;');
  });
  it.each([0.1, Number.MIN_VALUE, 1e308, 1.2345678901234567, 0])(
    'XML-15 full finite double %s',
    (value) => {
      const b = new SvgDocumentBuilder(defaultLimits);
      b.append('rect', 'r', { attributes: { x: value, width: 1, height: 1 } });
      const encoded = new XmlSvgEncoder().encode(b.build().describe());
      const parsed = parse(encoded);
      expect(Number(parsed.getElementsByTagName('rect').item(0)!.getAttribute('x'))).toBe(value);
    },
  );
  it('LIM-10 output is not clipped or limited by maxSvgBytes input admission', () => {
    const b = new SvgDocumentBuilder({ ...defaultLimits, maxSvgBytes: 1 });
    b.append('text', 't', { attributes: {}, text: 'long output 中文🙂' });
    const result = new XmlSvgEncoder().encode(b.build().describe());
    expect(Buffer.byteLength(result)).toBeGreaterThan(1);
    expect(parse(result).getElementsByTagName('text').item(0)!.textContent).toBe(
      'long output 中文🙂',
    );
  });
  it('known metadata permits no extra root attributes, unsupported shapes/attrs or complex content', () => {
    const b = new SvgDocumentBuilder(defaultLimits);
    b.append('rect', 'r', { attributes: { width: 1, height: 1 } });
    const doc = b.build().describe();
    const encoder = new XmlSvgEncoder();
    expect(() =>
      encoder.encode({ ...doc, attributes: [{ name: 'transform', value: 'translate(0,0)' }] }),
    ).toThrow();
    expect(() =>
      encoder.encode({
        ...doc,
        children: [{ ...doc.children[0]!, shape: { ...doc.children[0]!.shape, type: 'script' } }],
      }),
    ).toThrow();
    expect(() =>
      encoder.encode({ ...doc, children: [{ ...doc.children[0]!, children: [doc.children[0]!] }] }),
    ).toThrow();
    expect(() =>
      encoder.encode({
        ...doc,
        children: [
          {
            ...doc.children[0]!,
            shape: {
              ...doc.children[0]!.shape,
              attributes: [...doc.children[0]!.shape.attributes, { name: 'width', value: 2 }],
            },
          },
        ],
      }),
    ).toThrow();
  });
});
