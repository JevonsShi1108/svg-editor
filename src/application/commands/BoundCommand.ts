import type { CommandCoordinator, ExecuteMode } from '../internal/protocols.js';
import type { ExecutionResult } from '../contracts/api.js';
export abstract class BoundCommand {
  abstract dispatch(
    coordinator: CommandCoordinator,
    mode: ExecuteMode,
  ): ExecutionResult | Promise<ExecutionResult>;
}
