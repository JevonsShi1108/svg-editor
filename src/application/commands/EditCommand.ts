import { BoundCommand } from './BoundCommand.js';
import type { CommandCoordinator, ExecuteMode } from '../internal/protocols.js';
import type { ExecutionResult, EditFacts } from '../contracts/api.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditTransaction } from '../../domain/transactions/EditTransaction.js';
export abstract class EditCommand extends BoundCommand {
  abstract run(document: SvgDocument, tx: EditTransaction): EditFacts;
  override dispatch(coordinator: CommandCoordinator, mode: ExecuteMode): ExecutionResult {
    return coordinator.edit(this, mode);
  }
}
