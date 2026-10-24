import { expect, it } from 'vitest';
import fc from 'fast-check';
import { CliParser } from '../../src/cli/CliParser.js';
import { ioFixture } from '../helpers/io-session.js';
import { committed, semantic } from '../helpers/session.js';
import { PropertyRunner } from '../helpers/PropertyRunner.js';
import type { CommandRequest } from '../../src/application/contracts/api.js';
it('PROP-16 equivalent CLI and independent API sequence match document/status/results including IO', () =>
  PropertyRunner.checkAsync(
    'PROP-16',
    fc.asyncProperty(
      fc.integer({ min: -100, max: 100 }),
      fc.integer({ min: 1, max: 5 }),
      fc.constantFrom(' a  in # 中文🙂 ', '', 'quote " slash \\'),
      async (dx, factor, text) => {
        const a = ioFixture(),
          b = ioFixture();
        const parser = new CliParser(a.catalog);
        const quote = (s: string) => `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
        const cases: readonly (readonly [string, CommandRequest])[] = [
          ['init 400 300', { command: 'init', size: { width: 400, height: 300 } }],
          ['create g in', { command: 'create', shape: { type: 'g', id: 'in' } }],
          [
            'create rect r 1 2 3 4 #4a90d9 in in',
            {
              command: 'create',
              shape: { type: 'rect', id: 'r', x: 1, y: 2, width: 3, height: 4, fill: '#4a90d9' },
              parentId: 'in',
            },
          ],
          [
            `create text t 5 6 ${quote(text)} in in`,
            {
              command: 'create',
              shape: { type: 'text', id: 't', x: 5, y: 6, text },
              parentId: 'in',
            },
          ],
          [`move in ${dx} -2`, { command: 'move', id: 'in', dx, dy: -2 }],
          [`scale in ${factor}`, { command: 'scale', id: 'in', factor }],
          ['undo', { command: 'undo' }],
          ['redo', { command: 'redo' }],
          ['save "a b.svg"', { command: 'save', path: 'a b.svg' }],
          ['read "a b.svg"', { command: 'read', path: 'a b.svg' }],
          ['tree', { command: 'tree' }],
          ['show t', { command: 'show', id: 't' }],
        ];
        for (const [line, request] of cases) {
          const cli = committed(await a.session.execute(parser.parse(line)!));
          const api = committed(await b.session.execute(request));
          expect(cli).toEqual(api);
          expect(await semantic(a.session)).toEqual(await semantic(b.session));
        }
        expect([...a.files.files]).toEqual([...b.files.files]);
      },
    ),
  ));
