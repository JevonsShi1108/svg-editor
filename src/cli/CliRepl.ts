import type { SessionExecutor, CommandRequest } from '../application/contracts/api.js';
import { EditorError } from '../application/errors/EditorError.js';
import { CliParser } from './CliParser.js';
import { TextPresenter } from './TextPresenter.js';
export interface TerminalOutput {
  readonly interactive: boolean;
  stdout(text: string): Promise<void>;
  stderr(text: string): Promise<void>;
}
export class CliRepl {
  readonly #session: SessionExecutor;
  readonly #parser: CliParser;
  readonly #presenter: TextPresenter;
  constructor(session: SessionExecutor, parser: CliParser, presenter = new TextPresenter()) {
    this.#session = session;
    this.#parser = parser;
    this.#presenter = presenter;
  }
  async run(lines: AsyncIterable<string>, output: TerminalOutput): Promise<number> {
    let poisoned = false;
    if (output.interactive) await output.stdout('svg> ');
    for await (const line of lines) {
      let request: CommandRequest | null;
      try {
        request = this.#parser.parse(line);
      } catch (error) {
        await output.stderr(this.#presenter.diagnostic(EditorError.from(error).diagnostic));
        if (output.interactive) await output.stdout('svg> ');
        continue;
      }
      if (request) {
        const result = await this.#session.execute(request);
        poisoned = result.status.state === 'poisoned';
        const rendered = this.#presenter.render(result);
        if (rendered.stdout) await output.stdout(rendered.stdout);
        if (rendered.stderr) await output.stderr(rendered.stderr);
      }
      if (output.interactive) await output.stdout('svg> ');
    }
    return poisoned ? 1 : 0;
  }
}
