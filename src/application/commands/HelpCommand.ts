import { QueryCommand } from './QueryCommand.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { ResultData, CommandParser } from '../contracts/api.js';
export class HelpCommand extends QueryCommand {
  override get requiresDocument(): boolean {
    return false;
  }
  override run(_doc: SvgDocument | null, catalog: CommandParser): ResultData {
    return { kind: 'help', commands: catalog.describe() };
  }
}
