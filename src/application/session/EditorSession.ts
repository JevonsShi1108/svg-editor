import type {
  CommandRequest,
  ExecuteOptions,
  ExecutionResult,
  SessionExecutor,
} from '../contracts/api.js';
import type {
  SessionDependencies,
  SessionHead,
  CommandCoordinator,
  ExecuteMode,
} from '../internal/protocols.js';
import type { StateId } from '../contracts/history.js';
import type { EditCommand } from '../commands/EditCommand.js';
import type { QueryCommand } from '../commands/QueryCommand.js';
import type { CanvasSize } from '../../domain/values/contracts.js';
import type { SvgDocument } from '../../domain/document/SvgDocument.js';
import type { EditLease } from '../../domain/transactions/EditLease.js';
import { SvgDocumentBuilder } from '../../domain/document/SvgDocumentBuilder.js';
import { ValueRules } from '../../domain/values/ValueRules.js';
import { HistoryManager } from '../history/HistoryManager.js';
import { HistoryEntry } from '../history/HistoryEntry.js';
import { EditorError } from '../errors/EditorError.js';
import { FrozenValue } from '../internal/FrozenValue.js';
import { ResultFactory } from '../internal/ResultFactory.js';
export class EditorSession implements SessionExecutor {
  readonly #dependencies: SessionDependencies;
  readonly #coordinator: CommandCoordinator;
  #head: SessionHead = Object.freeze({
    document: null,
    currentStateId: null,
    savedStateId: null,
    currentPath: null,
    revision: 0,
    history: HistoryManager.empty(),
    health: 'ready',
  });
  #tail: Promise<void> = Promise.resolve();
  constructor(dependencies: SessionDependencies) {
    const rules = new ValueRules(dependencies.limits);
    this.#dependencies = Object.freeze({ ...dependencies, limits: rules.limits });
    this.#coordinator = Object.freeze({
      edit: (command: EditCommand, mode: ExecuteMode) => this.#edit(command, mode),
      query: (command: QueryCommand, mode: ExecuteMode) => this.#query(command, mode),
      initialize: (size: CanvasSize, mode: ExecuteMode) => this.#initialize(size, mode),
      history: (direction: 'undo' | 'redo', mode: ExecuteMode) => this.#history(direction, mode),
    });
  }
  execute(request: CommandRequest, options?: ExecuteOptions): Promise<ExecutionResult> {
    let snapshot: CommandRequest;
    let copiedOptions: ExecuteOptions | undefined;
    let copyError: unknown;
    try {
      snapshot = FrozenValue.copy(request);
      copiedOptions = FrozenValue.copy(options);
    } catch (error) {
      copyError = error;
    }
    const task = this.#tail.then(async () => {
      try {
        if (copyError) throw new EditorError('INVALID_REQUEST');
        const mode = copiedOptions?.mode ?? 'commit';
        if (mode !== 'commit' && mode !== 'dry-run') throw new EditorError('UNSUPPORTED_MODE');
        return await this.#dependencies.commands.bind(snapshot).dispatch(this.#coordinator, mode);
      } catch (error) {
        return this.#failure(error);
      }
    });
    this.#tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }
  #requireDocument(): SvgDocument {
    if (this.#head.health === 'poisoned') throw new EditorError('SESSION_POISONED');
    if (!this.#head.document) throw new EditorError('NO_DOCUMENT');
    return this.#head.document;
  }
  #requireCommit(mode: ExecuteMode): void {
    if (mode !== 'commit') throw new EditorError('UNSUPPORTED_MODE');
  }
  #initialize(size: CanvasSize, mode: ExecuteMode): ExecutionResult {
    this.#requireCommit(mode);
    const before = this.#head;
    const document = new SvgDocumentBuilder(this.#dependencies.limits, size).build();
    const next: SessionHead = Object.freeze({
      document,
      currentStateId: Symbol('state') as StateId,
      savedStateId: null,
      currentPath: null,
      history: HistoryManager.empty().afterBarrier('init'),
      revision: before.revision + 1,
      health: 'ready',
    });
    const result = ResultFactory.commit(
      next,
      { kind: 'document', operation: 'init', size: document.root.size, nodeCount: 0 },
      true,
      true,
    );
    this.#head = next;
    return result;
  }
  #query(command: QueryCommand, mode: ExecuteMode): ExecutionResult {
    this.#requireCommit(mode);
    const doc = command.requiresDocument ? this.#requireDocument() : null;
    return ResultFactory.commit(this.#head, command.run(doc, this.#dependencies.commands));
  }
  #edit(command: EditCommand, mode: ExecuteMode): ExecutionResult {
    this.#requireCommit(mode);
    const before = this.#head;
    const document = this.#requireDocument();
    const lease = document.beginEdit();
    let next: SessionHead;
    let result: ExecutionResult;
    try {
      const facts = command.run(document, lease.tx);
      const changes = lease.prepare();
      const state = changes.isEmpty ? before.currentStateId! : (Symbol('state') as StateId);
      const entry = changes.isEmpty
        ? null
        : new HistoryEntry(document.documentId, before.currentStateId!, state, changes, {
            operation: facts.operation,
            targetIds: facts.targetIds,
          });
      const history = before.history.afterEdit(entry);
      const sessionChanged = history !== before.history;
      next = Object.freeze({
        ...before,
        currentStateId: state,
        history,
        revision: before.revision + (sessionChanged ? 1 : 0),
      });
      result = ResultFactory.commit(
        next,
        { kind: 'edit', facts },
        !changes.isEmpty,
        sessionChanged,
      );
    } catch (error) {
      return this.#rollbackOrPoison(before, lease, error);
    }
    lease.commitPrepared();
    this.#head = next;
    return result;
  }
  #history(direction: 'undo' | 'redo', mode: ExecuteMode): ExecutionResult {
    this.#requireCommit(mode);
    const before = this.#head;
    const document = this.#requireDocument();
    const entry =
      direction === 'undo'
        ? before.history.peekUndo(document.documentId, before.currentStateId!)
        : before.history.peekRedo(document.documentId, before.currentStateId!);
    const lease = document.beginEdit();
    let next: SessionHead;
    let result: ExecutionResult;
    try {
      entry.changes.replay(lease.tx, direction === 'undo' ? 'backward' : 'forward');
      lease.prepare();
      const history =
        direction === 'undo' ? before.history.afterUndo(entry) : before.history.afterRedo(entry);
      next = Object.freeze({
        ...before,
        currentStateId: direction === 'undo' ? entry.beforeStateId : entry.afterStateId,
        history,
        revision: before.revision + 1,
      });
      result = ResultFactory.commit(
        next,
        {
          kind: 'history',
          direction,
          description: entry.description,
          changes: entry.changes.describe(direction === 'undo' ? 'backward' : 'forward'),
        },
        true,
        true,
      );
    } catch (error) {
      return this.#rollbackOrPoison(before, lease, error);
    }
    lease.commitPrepared();
    this.#head = next;
    return result;
  }
  #rollbackOrPoison(before: SessionHead, lease: EditLease, error: unknown): ExecutionResult {
    try {
      if (lease.tx.phase === 'poisoned') return this.#poison(before);
      lease.rollback();
    } catch {
      return this.#poison(before);
    }
    return this.#failure(error);
  }
  #failure(error: unknown): ExecutionResult {
    const converted = EditorError.from(error);
    if (
      converted.diagnostic.code === 'INTERNAL_INVARIANT_ERROR' ||
      converted.diagnostic.code === 'UNTRUSTED'
    )
      return this.#poison(this.#head);
    return ResultFactory.failure(this.#head, converted.diagnostic);
  }
  #poison(before: SessionHead): ExecutionResult {
    if (before.health !== 'poisoned')
      this.#head = Object.freeze({ ...before, health: 'poisoned', revision: before.revision + 1 });
    return ResultFactory.failure(
      this.#head,
      new EditorError('SESSION_POISONED').diagnostic,
      'untrusted',
    );
  }
}
