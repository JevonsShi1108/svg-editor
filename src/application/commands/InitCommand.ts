import { BoundCommand } from './BoundCommand.js';
import type { CanvasSize } from '../../domain/values/contracts.js';
import type { CommandCoordinator, ExecuteMode } from '../internal/protocols.js';
import type { ExecutionResult } from '../contracts/api.js';
export class InitCommand extends BoundCommand {
  readonly #size: CanvasSize;
  constructor(size: CanvasSize) {
    super();
    this.#size = Object.freeze({ ...size });
  }
  override dispatch(coordinator: CommandCoordinator, mode: ExecuteMode): ExecutionResult {
    return coordinator.initialize(this.#size, mode);
  }
}
