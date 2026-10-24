import type { InputToken } from '../contracts/api.js';
import type { ValueRules } from '../../domain/values/ValueRules.js';
import { EditorError } from '../errors/EditorError.js';
export class CommandArguments {
  constructor(
    readonly tokens: readonly InputToken[],
    readonly rules: ValueRules,
  ) {}
  expect(min: number, max = min): void {
    if (this.tokens.length < min || this.tokens.length > max) throw new EditorError('SYNTAX_ERROR');
  }
  value(index: number): string {
    const token = this.tokens[index];
    if (!token) throw new EditorError('SYNTAX_ERROR');
    return token.value;
  }
  id(index: number): string {
    return this.rules.id(this.value(index));
  }
  number(index: number): number {
    return this.rules.numeric(this.value(index));
  }
}
