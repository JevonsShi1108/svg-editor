import { BoundCommand } from './BoundCommand.js';
import type { CanvasSize } from '../../domain/values/contracts.js';
import type { CommandCoordinator, ExecuteMode } from '../internal/protocols.js';
import type { ExecutionResult } from '../contracts/api.js';
export class CanvasCommand extends BoundCommand {
  readonly #size: CanvasSize | undefined;
  constructor(size?: CanvasSize) {
    super();
    this.#size = size;
  }
  override dispatch(coordinator: CommandCoordinator, mode: ExecuteMode): ExecutionResult {
    return coordinator.canvas(this.#size, mode);
  }
}
