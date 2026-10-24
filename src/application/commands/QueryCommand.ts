import { BoundCommand } from './BoundCommand.js';
import type { CommandCoordinator, ExecuteMode } from '../internal/protocols.js';
import type { ExecutionResult, ResultData, CommandParser } from '../contracts/api.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
export abstract class QueryCommand extends BoundCommand {
  get requiresDocument(): boolean {
    return true;
  }
  abstract run(document: SvgDocument | null, catalog: CommandParser): ResultData;
  override dispatch(coordinator: CommandCoordinator, mode: ExecuteMode): ExecutionResult {
    return coordinator.query(this, mode);
  }
}
