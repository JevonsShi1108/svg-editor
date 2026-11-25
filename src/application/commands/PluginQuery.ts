import { QueryCommand } from './QueryCommand.js';
import type { Command } from '../contracts/Command.js';
import type { ResultData } from '../contracts/api.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { ShapeRegistry } from '../../domain/shapes/ShapeRegistry.js';
import { EditorError } from '../errors/EditorError.js';

export class PluginQuery extends QueryCommand {
  constructor(
    private readonly command: Command,
    private readonly args: readonly string[],
    private readonly shapes: ShapeRegistry,
  ) {
    super();
  }
  override get requiresDocument() {
    return this.command.requiresDocument;
  }
  override async run(document: SvgDocument | null): Promise<ResultData> {
    const context = Object.freeze({
      document: document?.describe() ?? null,
      isContainer: (type: string) =>
        this.shapes.definition(type).schema.contentModel === 'container',
    });
    const lines = await this.command.run(context, this.args);
    if (!Array.isArray(lines) || !lines.every((line) => typeof line === 'string'))
      throw new EditorError('INVALID_COMMAND_RESULT', { name: this.command.help.name });
    return { kind: 'lines', lines: [...lines] };
  }
}
