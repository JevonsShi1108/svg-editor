import { expect, it } from 'vitest';
import { SvgOutline } from '../../extensions/svg-tools/src/SvgOutline.js';

it('maps source names, nesting and original UTF-16 intervals across CRLF and XML markup', () => {
  const source =
    '<svg>🙂<!-- <fake/> -->\r\n<g\r\n id="中&amp;x" a=">"><path/><path/><text><![CDATA[<g>]]></text></g></svg>';
  const nodes = new SvgOutline().parse(source);
  expect(nodes.map((n) => [n.name, n.parent])).toEqual([
    ['svg', undefined],
    ['g#中&x', 0],
    ['path', 1],
    ['path', 1],
    ['text', 1],
  ]);
  expect(nodes.map((n) => source.slice(n.start, n.openingEnd))).toEqual([
    '<svg>',
    '<g\r\n id="中&amp;x" a=">">',
    '<path/>',
    '<path/>',
    '<text>',
  ]);
  expect(source.slice(nodes[4]!.start, nodes[4]!.end)).toBe('<text><![CDATA[<g>]]></text>');
  expect(nodes[0]!.end).toBe(source.length);
});

it('discards a partial tree and recovers using the next buffer', () => {
  const scanner = new SvgOutline();
  expect(scanner.parse('<svg><g/></svg>')).toHaveLength(2);
  expect(scanner.parse('<svg><g/>')).toEqual([]);
  expect(scanner.parse('<svg><g id="ready"/></svg>')[1]?.name).toBe('g#ready');
});
