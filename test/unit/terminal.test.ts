import { expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { NodeTerminal } from '../../src/cli/NodeTerminal.js';
import { parseXml10 } from '../helpers/parse-xml10.js';
it('CLI-14 NodeTerminal waits write callback, preserves channels and remembers fatal output error', async () => {
  const chunks: string[] = [];
  let complete: ((error?: Error | null) => void) | undefined;
  const out = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      complete = callback;
    },
  });
  const errors: string[] = [];
  const err = new Writable({
    write(chunk, _encoding, callback) {
      errors.push(String(chunk));
      callback();
    },
  });
  const terminal = new NodeTerminal(out, err, true);
  let resolved = false;
  const writing = terminal.stdout('success\n').then(() => {
    resolved = true;
  });
  await Promise.resolve();
  expect(resolved).toBe(false);
  complete!();
  await writing;
  expect(resolved).toBe(true);
  await terminal.stderr('diagnostic\n');
  expect(chunks).toEqual(['success\n']);
  expect(errors).toEqual(['diagnostic\n']);
  expect(terminal.interactive).toBe(true);
  const failure = new Error('device gone');
  out.emit('error', failure);
  await expect(terminal.stdout('never')).rejects.toBe(failure);
  expect(chunks).toHaveLength(1);
  err.emit('error', failure);
  await expect(terminal.stderr('never')).rejects.toBe(failure);
});
it('CLI-14 NodeTerminal callback error is a terminal failure, never file IO failure', async () => {
  const failure = new Error('EPIPE');
  const stream = new Writable({
    write(_chunk, _encoding, callback) {
      callback(failure);
    },
  });
  const terminal = new NodeTerminal(
    stream,
    new Writable({
      write(_c, _e, cb) {
        cb();
      },
    }),
    false,
  );
  await expect(terminal.stdout('committed')).rejects.toBe(failure);
});
it('XML oracle calibration uses XML 1.0 literal newline rules and reference-preserved CR/NEL', () => {
  const document = parseXml10('<text>a\r\nb\rc\u0085\u2028&#13;&#133;</text>');
  expect(document.documentElement!.textContent).toBe('a\nb\nc\u0085\u2028\r\u0085');
  expect(() => parseXml10('<text>&unknown;</text>')).toThrow();
});
