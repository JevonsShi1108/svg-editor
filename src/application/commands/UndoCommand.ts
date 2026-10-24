import { BoundCommand } from './BoundCommand.js';
import type { CommandCoordinator, ExecuteMode } from '../internal/protocols.js';
import type { ExecutionResult } from '../contracts/api.js';
export class UndoCommand extends BoundCommand {
  override dispatch(coordinator: CommandCoordinator, mode: ExecuteMode): ExecutionResult {
    return coordinator.history('undo', mode);
  }
}
