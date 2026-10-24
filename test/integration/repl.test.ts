import { expect, it } from 'vitest';
import { CliParser } from '../../src/cli/CliParser.js';
import { CliRepl } from '../../src/cli/CliRepl.js';
import { sessionFixture } from '../helpers/session.js';
async function* lines(input: string[]) {
  yield* input;
}
it('M06 real adapter → Session → Domain → history slice, errors do not discard subsequent lines', async () => {
  const { session, catalog, ports } = sessionFixture();
  let stdout = '',
    stderr = '';
  const exit = await new CliRepl(session, new CliParser(catalog)).run(
    lines([
      '# comment',
      'init',
      'create rect r 10 20 30 40 red',
      'move r 5 -3',
      'undo',
      'tree',
      'move missing 1 1',
      'show r',
      'help',
    ]),
    {
      interactive: false,
      stdout: async (text) => {
        stdout += text;
      },
      stderr: async (text) => {
        stderr += text;
      },
    },
  );
  expect(exit).toBe(0);
  expect(stdout).toContain('svg (800x600)');
  expect(stdout).toContain('rect#r');
  expect(stdout).toContain('x=10');
  expect(stdout).toContain('parent=svg');
  expect(stdout).not.toContain('svg>');
  expect(stderr).toBe('error: no such shape: missing\n');
  expect(ports.calls).toEqual([]);
});
it('TTY prompts, while blank lines never execute or alter history', async () => {
  const { session, catalog } = sessionFixture();
  let stdout = '';
  await new CliRepl(session, new CliParser(catalog)).run(lines(['', 'help']), {
    interactive: true,
    stdout: async (text) => {
      stdout += text;
    },
    stderr: async () => {},
  });
  expect(stdout.match(/svg> /g)).toHaveLength(3);
});
