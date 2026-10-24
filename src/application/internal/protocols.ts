import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { CanvasSize, ResourceLimits } from '../../domain/values/contracts.js';
import type { StateId } from '../contracts/history.js';
import type { ExecutionResult } from '../contracts/api.js';
import type { HistoryManager } from '../history/HistoryManager.js';
import type { CommandCatalog } from '../commands/CommandCatalog.js';
import type { EditCommand } from '../commands/EditCommand.js';
import type { QueryCommand } from '../commands/QueryCommand.js';
import type { SvgCodec } from '../ports/SvgCodec.js';
import type { FileStore, FilePath } from '../ports/FileStore.js';
export type ExecuteMode = 'commit' | 'dry-run';
export interface SessionDependencies {
  readonly commands: CommandCatalog;
  readonly codec: SvgCodec;
  readonly files: FileStore;
  readonly limits: ResourceLimits;
}
export interface SessionHead {
  readonly document: SvgDocument | null;
  readonly currentStateId: StateId | null;
  readonly savedStateId: StateId | null;
  readonly currentPath: FilePath | null;
  readonly revision: number;
  readonly history: HistoryManager;
  readonly health: 'ready' | 'poisoned';
}
export interface CommandCoordinator {
  edit(command: EditCommand, mode: ExecuteMode): ExecutionResult;
  query(command: QueryCommand, mode: ExecuteMode): ExecutionResult;
  initialize(size: CanvasSize, mode: ExecuteMode): ExecutionResult;
  history(direction: 'undo' | 'redo', mode: ExecuteMode): ExecutionResult;
  canvas(size: CanvasSize | undefined, mode: ExecuteMode): ExecutionResult;
}
