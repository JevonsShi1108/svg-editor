import { BoundCommand } from './BoundCommand.js';
import type { CommandCoordinator, ExecuteMode } from '../internal/protocols.js';
import type { ExecutionResult } from '../contracts/api.js';
export class SaveCommand extends BoundCommand {
  readonly #path: string | undefined;
  constructor(path?: string) {
    super();
    this.#path = path;
  }
  override dispatch(coordinator: CommandCoordinator, mode: ExecuteMode): Promise<ExecutionResult> {
    return coordinator.save(this.#path, mode);
  }
}
