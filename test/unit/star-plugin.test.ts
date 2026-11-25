import { expect, it } from 'vitest';
import type { DocumentDescription, TreeNodeDescription } from '@svgframe/api';
import { ModifiedStar } from '../../plugins/tree-star/src/ModifiedStar.js';

const leaf = (id: string, value: string): TreeNodeDescription => ({
  shape: { type: 'text', id, attributes: [], displayFields: [], text: value },
  children: [],
});
const group = (id: string, ...children: TreeNodeDescription[]): TreeNodeDescription => ({
  shape: { type: 'g', id, attributes: [], displayFields: [] },
  children,
});
const doc = (...children: TreeNodeDescription[]): DocumentDescription => ({
  size: { width: 10, height: 20 },
  attributes: [],
  children,
});
it('compares saved content, tracks repaired rows and ancestors, and isolates sessions', () => {
  const star = new ModifiedStar(),
    fresh = new ModifiedStar();
  const text = leaf('svg', 'a'),
    original = doc(group('g', text));
  const tags = (d: DocumentDescription) => {
    const label = star.prepare(d);
    return [null, d.children[0]!, d.children[0]!.children[0]!].map(label);
  };
  expect(tags(original)).toEqual(['*', '*', '*']);
  star.checkpoint(original, []);
  expect(tags(original)).toEqual([undefined, undefined, undefined]);
  const edited = doc(group('g', leaf('svg', 'b')));
  expect(tags(edited)).toEqual(['*', '*', '*']);
  expect(tags(original)).toEqual([undefined, undefined, undefined]);
  expect(tags(edited)).toEqual(['*', '*', '*']);
  expect(fresh.prepare(original)(null)).toBe('*');
  star.checkpoint(original, ['svg']);
  expect(tags(original)).toEqual(['*', '*', '*']);
  star.checkpoint(original, []);
  expect(tags(doc(group('g', leaf('svg', 'a'))))).toEqual([undefined, undefined, undefined]);
  star.checkpoint(null, []);
  expect(tags(original)).toEqual(['*', '*', '*']);
});
it('detects removal, reorder, parent changes and canvas changes', () => {
  const star = new ModifiedStar(),
    a = leaf('a', '1'),
    b = leaf('b', '2');
  star.checkpoint(doc(group('left', a, b), group('right')), []);
  const moved = doc(group('left', a), group('right', b));
  expect([null, ...moved.children, b, a].map(star.prepare(moved))).toEqual([
    '*',
    '*',
    '*',
    '*',
    undefined,
  ]);
  const reordered = doc(group('left', b, a), group('right'));
  expect([null, ...reordered.children, b, a].map(star.prepare(reordered))).toEqual([
    '*',
    '*',
    undefined,
    undefined,
    undefined,
  ]);
  expect(star.prepare(doc(group('left', a)))(null)).toBe('*');
  expect(star.prepare({ ...reordered, size: { width: 50, height: 20 } })(null)).toBe('*');
});
