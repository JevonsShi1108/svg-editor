import { expect, it } from 'vitest';
import { CliParser } from '../../src/cli/CliParser.js';
import { sessionFixture } from '../helpers/session.js';
import { protocolCases, invalidLines } from '../fixtures/cli-protocol.js';
import type { ShapeCreation } from '../../src/domain/values/contracts.js';
const { catalog } = sessionFixture();
const parser = new CliParser(catalog);
const creations: readonly (readonly [string, ShapeCreation])[] = [
  ['create rect r 10 20 30 40', { type: 'rect', id: 'r', x: 10, y: 20, width: 30, height: 40 }],
  ['create circle c 12 18 5', { type: 'circle', id: 'c', cx: 12, cy: 18, r: 5 }],
  ['create ellipse e 9 15 3 6', { type: 'ellipse', id: 'e', cx: 9, cy: 15, rx: 3, ry: 6 }],
  ['create line l 1 2 11 22', { type: 'line', id: 'l', x1: 1, y1: 2, x2: 11, y2: 22 }],
  ['create text t 7 8 "A"', { type: 'text', id: 't', x: 7, y: 8, text: 'A' }],
  ['create g g', { type: 'g', id: 'g' }],
];
for (const parentId of [undefined, 'P'])
  it.each(creations)(`CRT-01 CLI six types parent=${parentId ?? 'root'} %s`, (line, shape) => {
    const request = parser.parse(line + (parentId === undefined ? '' : ` in ${parentId}`));
    expect(request).toEqual({
      command: 'create',
      shape,
      ...(parentId === undefined ? {} : { parentId }),
    });
    expect(() => catalog.bind(request!)).not.toThrow();
  });
it.each(protocolCases)(
  'CLI-07 independent 19-command request and binding: %s',
  (line, expected) => {
    const request = parser.parse(line);
    expect(request).toEqual(expected);
    expect(() => catalog.bind(request!)).not.toThrow();
  },
);
it('CLI-07 help enumerates exactly the independently listed 19 commands', () => {
  expect(
    catalog
      .describe()
      .map((entry) => entry.name)
      .sort(),
  ).toEqual(protocolCases.map(([, request]) => request.command).sort());
});
it.each(invalidLines)('CLI-05/08/09/10/12 rejects malformed command %s', (line) => {
  expect(() => parser.parse(line)).toThrow();
});
it('CLI-06 preserves literal Windows paths, spaces, #, and the two declared escapes', () => {
  expect(parser.parse(String.raw`read "C:\目录\a b # in.svg"`)).toEqual({
    command: 'read',
    path: String.raw`C:\目录\a b # in.svg`,
  });
  expect(parser.parse(String.raw`save "a\"b\\c.svg"`)).toEqual({
    command: 'save',
    path: 'a"b\\c.svg',
  });
});
it('CLI-03/04/10 literal in ID/text and empty text, line color is stroke only', () => {
  expect(parser.parse('create text in 1 2 " in "')).toEqual({
    command: 'create',
    shape: { type: 'text', id: 'in', x: 1, y: 2, text: ' in ' },
  });
  expect(parser.parse('create text t 1 2 "" in in')).toEqual({
    command: 'create',
    shape: { type: 'text', id: 't', x: 1, y: 2, text: '' },
    parentId: 'in',
  });
  expect(parser.parse('create line l 1 2 3 4 red')).toEqual({
    command: 'create',
    shape: { type: 'line', id: 'l', x1: 1, y1: 2, x2: 3, y2: 4, stroke: 'red' },
  });
});
