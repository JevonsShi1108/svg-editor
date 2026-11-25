import type { CommandHelp } from './api.js';
import type { DocumentDescription } from '../../domain/values/contracts.js';

export interface QueryContext {
  readonly document: DocumentDescription | null;
  isContainer(type: string): boolean;
}

export interface Command {
  readonly help: CommandHelp;
  readonly requiresDocument: boolean;
  readonly arity: readonly [minimum: number, maximum: number];
  run(
    context: QueryContext,
    args: readonly string[],
  ): readonly string[] | Promise<readonly string[]>;
}
