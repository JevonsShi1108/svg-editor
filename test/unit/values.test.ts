import { describe, expect, it } from 'vitest';
import { ValueRules } from '../../src/domain/values/ValueRules.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { SemanticSnapshot } from '../helpers/SemanticSnapshot.js';
import type { DocumentDescription } from '../../src/domain/values/contracts.js';

const rules = new ValueRules(defaultLimits);
describe('VAL-01/02/03/04 — EXEC-P1 independent number table', () => {
  it.each([
    ['0', 0],
    ['-0', 0],
    ['+3', 3],
    ['1.', 1],
    ['.5', 0.5],
    ['-2.5E-4', -0.00025],
    ['5e-324', Number.MIN_VALUE],
    ['0e-400', 0],
    [' 1\t', 1],
  ] as const)('accepts %s', (input, expected) =>
    expect(Object.is(rules.numeric(input), expected)).toBe(true),
  );
  it.each([
    '',
    ' ',
    '0x10',
    '0b10',
    '1_000',
    '1,000',
    'NaN',
    'Infinity',
    '10oops',
    '1e',
    '1e309',
    '1e-400',
    '1 px',
    '1PX',
    '\u00a01',
  ])('rejects %s', (input) => expect(() => rules.numeric(input)).toThrow());
  it.each([null, true, [], {}, '1', NaN, Infinity, -Infinity])(
    'API number refuses coercion %s',
    (value) => expect(() => rules.number(value)).toThrow(),
  );
  it('GEO-10 permits zero geometry, rejects zero canvas/factor and underflow', () => {
    expect(rules.number(0, 'nonnegative')).toBe(0);
    expect(rules.number(-3)).toBe(-3);
    expect(() => rules.number(-1, 'nonnegative')).toThrow();
    expect(() => rules.size({ width: 0, height: 1 })).toThrow();
    expect(() => rules.product(1, 0)).toThrow();
    expect(() => rules.product(Number.MIN_VALUE, 0.5)).toThrow();
    expect(rules.product(0, 0.5)).toBe(0);
    expect(rules.numeric('2px', 'coordinate', 'x', true)).toBe(2);
    expect(() => rules.numeric('2px')).toThrow();
  });
});
describe('VAL-05 Paint independent examples', () => {
  it.each([
    ['RED', 'red'],
    ['#ABC', '#abc'],
    ['#AABBCC', '#aabbcc'],
    ['none', 'none'],
    ['LightGoldenRodYellow', 'lightgoldenrodyellow'],
    ['rebeccapurple', 'rebeccapurple'],
    ['grey', 'grey'],
  ])('normalizes %s', (a, b) => expect(rules.paint(a)).toBe(b));
  it.each([
    'transparent',
    'currentColor',
    'inherit',
    '#abcd',
    '#aabbccdd',
    'url(x)',
    'var(--x)',
    'rgb(0,0,0)',
    'notacolor',
    '',
  ])('rejects %s', (a) => expect(() => rules.paint(a)).toThrow());
  it('retained attributes remain constrained', () => {
    expect(rules.retained('font-size', '0px', true)).toBe(0);
    expect(rules.retained('text-anchor', ' middle ')).toBe('middle');
    expect(rules.retained('data-kind', 'box')).toBe('box');
    for (const [k, v] of [
      ['font-size', '-1'],
      ['text-anchor', 'MIDDLE'],
      ['data-kind', ' x'],
      ['style', 'red'],
    ])
      expect(() => rules.retained(k!, v)).toThrow();
  });
});
describe('VAL-06/XML-14/LIM-07/08 exact XML strings and limits', () => {
  it.each(['svg', 'in', 'R1', '_x', 'a.b-c_9'])('ID %s is legal', (id) =>
    expect(rules.id(id)).toBe(id),
  );
  it.each(['', ' a', 'a ', '1a', '中文', 'a:b', 'a\nb'])('ID %s is illegal', (id) =>
    expect(() => rules.id(id)).toThrow(),
  );
  it.each(['', ' 中文🙂  &<>\r\n\t', 'DOCTYPE', '\u{10000}', '\u{10ffff}'])(
    'preserves XML text %s',
    (text) => expect(rules.text(text)).toBe(text),
  );
  it.each(['\0', '\u0001', '\ud800', '\udc00', '\ufffe', '\uffff'])('rejects XML text %s', (text) =>
    expect(() => rules.text(text)).toThrow(),
  );
  it('counts Unicode scalars before trim, freezes limits', () => {
    const limits = { ...defaultLimits, maxTextLength: 3, maxAttributeLength: 3 };
    const r = new ValueRules(limits);
    limits.maxTextLength = 10;
    expect(r.text('a🙂')).toBe('a🙂');
    expect(r.text('a🙂b')).toBe('a🙂b');
    expect(() => r.text('a🙂bc')).toThrow();
    expect(r.id('abc')).toBe('abc');
    expect(() => r.id('abcd')).toThrow();
    expect(() => r.numeric('  1 ')).toThrow();
    expect(() => new ValueRules({ ...defaultLimits, maxNodeCount: 0 })).toThrow();
  });
});
it('Snapshot positive and negative oracles preserve root/order/presence/exact text', () => {
  const d: DocumentDescription = {
    size: { width: 800, height: 600 },
    attributes: [],
    children: [
      {
        shape: { type: 'text', id: 't', attributes: [], text: ' a  🙂\n', displayFields: [] },
        children: [],
      },
      { shape: { type: 'g', id: 'g', attributes: [], displayFields: [] }, children: [] },
    ],
  };
  expect(SemanticSnapshot.of(structuredClone(d))).toEqual(SemanticSnapshot.of(d));
  const variants = [structuredClone(d), structuredClone(d), structuredClone(d), structuredClone(d)];
  variants[0] = { ...d, children: [...d.children].reverse() };
  variants[1] = { ...d, attributes: [{ name: 'fill', value: 'black' }] };
  variants[2] = {
    ...d,
    children: [
      { ...d.children[0]!, shape: { ...d.children[0]!.shape, text: 'a 🙂' } },
      d.children[1]!,
    ],
  };
  variants[3] = { ...d, size: { width: 801, height: 600 } };
  for (const v of variants) expect(SemanticSnapshot.of(v!)).not.toEqual(SemanticSnapshot.of(d));
});
