import type { Writable } from 'node:stream';
import type { TerminalOutput } from './CliRepl.js';
export class NodeTerminal implements TerminalOutput {
  readonly interactive: boolean;
  readonly #out: Writable;
  readonly #err: Writable;
  #outError: Error | null = null;
  #errError: Error | null = null;
  constructor(out: Writable, err: Writable, interactive: boolean) {
    this.#out = out;
    this.#err = err;
    this.interactive = interactive;
    out.on('error', (error) => {
      this.#outError = error;
    });
    err.on('error', (error) => {
      this.#errError = error;
    });
  }
  stdout(text: string): Promise<void> {
    if (this.#outError) return Promise.reject(this.#outError);
    return this.write(this.#out, text);
  }
  stderr(text: string): Promise<void> {
    if (this.#errError) return Promise.reject(this.#errError);
    return this.write(this.#err, text);
  }
  private write(stream: Writable, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      stream.write(text, 'utf8', (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}
