import type { CommandParser, CommandRequest } from '../application/contracts/api.js';
import { EditorError } from '../application/errors/EditorError.js';
import { Tokenizer } from './Tokenizer.js';
export class CliParser {
  readonly #catalog: CommandParser;
  readonly #tokenizer = new Tokenizer();
  constructor(catalog: CommandParser) {
    this.#catalog = catalog;
  }
  parse(line: string): CommandRequest | null {
    try {
      const tokens = this.#tokenizer.tokenize(line);
      return tokens.length ? this.#catalog.parse(tokens) : null;
    } catch (error) {
      throw EditorError.from(error);
    }
  }
}
