import type { InputToken } from '../application/contracts/api.js';
import { EditorError } from '../application/errors/EditorError.js';
export class Tokenizer {
  tokenize(line: string): readonly InputToken[] {
    const tokens: InputToken[] = [];
    let i = 0;
    while (i < line.length && /\s/.test(line[i]!)) i++;
    if (line[i] === '#') return Object.freeze(tokens);
    while (i < line.length) {
      while (i < line.length && /\s/.test(line[i]!)) i++;
      if (i === line.length) break;
      const start = i;
      const quoted = line[i] === '"';
      let value = '';
      if (quoted) {
        i++;
        let closed = false;
        while (i < line.length) {
          const char = line[i++]!;
          if (char === '"') {
            closed = true;
            break;
          }
          if (char === '\\' && (line[i] === '"' || line[i] === '\\')) value += line[i++];
          else value += char;
        }
        if (!closed || (i < line.length && !/\s/.test(line[i]!)))
          throw new EditorError('SYNTAX_ERROR');
      } else {
        while (i < line.length && !/\s/.test(line[i]!)) {
          if (line[i] === '"') throw new EditorError('SYNTAX_ERROR');
          value += line[i++];
        }
      }
      tokens.push(Object.freeze({ value, start, end: i, quoted }));
    }
    return Object.freeze(tokens);
  }
}
