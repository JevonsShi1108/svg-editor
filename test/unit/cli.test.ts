import { expect, it, describe } from 'vitest';
import { CliParser } from '../../src/cli/CliParser.js';
import { Tokenizer } from '../../src/cli/Tokenizer.js';
import { sessionFixture } from '../helpers/session.js';
const parser = () => new CliParser(sessionFixture().catalog);
describe('M06 CLI lexical and binding slice — independent requests', () => {
  it.each(['', '  ', ' # a comment'])('CLI-01 skips %s', (line) =>
    expect(parser().parse(line)).toBeNull(),
  );
  it.each([
    ['init', { command: 'init' }],
    ['init 80 60', { command: 'init', size: { width: 80, height: 60 } }],
    ['help', { command: 'help' }],
    ['tree', { command: 'tree' }],
    ['tree svg', { command: 'tree', id: 'svg' }],
    ['show r', { command: 'show', id: 'r' }],
    [
      'create rect r 0 0 10 10 #4a90d9',
      {
        command: 'create',
        shape: { type: 'rect', id: 'r', x: 0, y: 0, width: 10, height: 10, fill: '#4a90d9' },
      },
    ],
    [
      'create text t 1 2 "a  in b # c 中文🙂" in g1',
      {
        command: 'create',
        shape: { type: 'text', id: 't', x: 1, y: 2, text: 'a  in b # c 中文🙂' },
        parentId: 'g1',
      },
    ],
    [
      'create text t 1 2 ""',
      { command: 'create', shape: { type: 'text', id: 't', x: 1, y: 2, text: '' } },
    ],
    ['move r 1.5 -2', { command: 'move', id: 'r', dx: 1.5, dy: -2 }],
    ['undo', { command: 'undo' }],
    ['redo', { command: 'redo' }],
  ])('CLI-02/03/04/07 %s', (line, expected) =>
    expect(parser().parse(line as string)).toEqual(expected),
  );
  it.each([
    'init 1',
    'init 1 2 3',
    'help x',
    'tree r x',
    'show',
    'move r 1',
    'move r 1 2 3',
    'create rect',
    'create rect r 0 0 1 1 in',
    'create rect r 0 0 1 1 in g in g',
    'create text t 1 2 "a',
    'create text t 1 2 a"b',
    'create text t 1 2 "a"b',
    'create g g red',
    'create text t 1 2 "A" red',
    'move r 10oops 0',
    'move r NaN 0',
    'move r Infinity 0',
    'unknown',
  ])('CLI-05/08/09/10/12 rejects %s', (line) => expect(() => parser().parse(line)).toThrow());
  it('CFG-06 quote/backslash only two special escapes and no inline comments', () => {
    const t = new Tokenizer();
    expect(t.tokenize(String.raw`x "a\n \"b\" \\"`).map((x) => x.value)).toEqual([
      'x',
      'a\\n "b" \\',
    ]);
    expect(t.tokenize('x #ff0000 # tail').map((x) => x.value)).toEqual([
      'x',
      '#ff0000',
      '#',
      'tail',
    ]);
  });
});
