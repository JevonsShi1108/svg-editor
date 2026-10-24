import type {
  CommandRequest,
  ExecuteOptions,
  ExecutionResult,
  SessionExecutor,
  Diagnostic,
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
import type { FilePath, WriteOutcome } from '../ports/FileStore.js';
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
      canvas: (size: CanvasSize | undefined, mode: ExecuteMode) => this.#canvas(size, mode),
      read: (path: string, mode: ExecuteMode) => this.#read(path, mode),
      save: (path: string | undefined, mode: ExecuteMode) => this.#save(path, mode),
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
    try {
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
    } catch (error) {
      return ResultFactory.failure(before, EditorError.from(error).diagnostic);
    }
  }
  async #read(path: string, mode: ExecuteMode): Promise<ExecutionResult> {
    this.#requireCommit(mode);
    const before = this.#head;
    let resolved: FilePath;
    let source: string;
    try {
      resolved = this.#dependencies.files.resolve(path);
      source = await this.#dependencies.files.readUtf8(
        resolved,
        this.#dependencies.limits.maxSvgBytes,
      );
    } catch (error) {
      const diagnostic = EditorError.from(error).diagnostic;
      return ResultFactory.failure(
        before,
        diagnostic.code === 'RESOURCE_LIMIT'
          ? diagnostic
          : new EditorError('FILE_IO_ERROR', { operation: 'read', path }).diagnostic,
      );
    }
    try {
      const decoded = this.#dependencies.codec.decode(source, this.#dependencies.limits);
      const state = Symbol('state') as StateId;
      const next: SessionHead = Object.freeze({
        document: decoded.document,
        currentStateId: state,
        savedStateId: decoded.semanticRepair ? null : state,
        currentPath: resolved,
        revision: before.revision + 1,
        history: HistoryManager.empty().afterBarrier('read'),
        health: 'ready',
      });
      const result = ResultFactory.commit(
        next,
        {
          kind: 'document',
          operation: 'read',
          size: decoded.document.root.size,
          nodeCount: decoded.document.nodeCount,
          path: resolved,
        },
        true,
        true,
        decoded.warnings,
      );
      this.#head = next;
      return result;
    } catch (error) {
      return ResultFactory.failure(before, EditorError.from(error).diagnostic);
    }
  }
  async #save(path: string | undefined, mode: ExecuteMode): Promise<ExecutionResult> {
    this.#requireCommit(mode);
    const before = this.#head;
    const document = this.#requireDocument();
    let resolved: FilePath;
    if (path === undefined && before.currentPath === null) throw new EditorError('NO_SAVE_PATH');
    const displayPath = path ?? before.currentPath!;
    try {
      resolved = path === undefined ? before.currentPath! : this.#dependencies.files.resolve(path);
    } catch {
      return ResultFactory.failure(
        before,
        new EditorError('FILE_IO_ERROR', { operation: 'write', path: displayPath }).diagnostic,
      );
    }
    let next: SessionHead;
    let result: ExecutionResult;
    let source: string;
    try {
      source = this.#dependencies.codec.encode(document.describe());
      next = Object.freeze({
        ...before,
        currentPath: resolved,
        savedStateId: before.currentStateId,
        history: before.history.afterBarrier('save'),
        revision: before.revision + 1,
      });
      result = ResultFactory.commit(
        next,
        {
          kind: 'document',
          operation: 'save',
          size: document.root.size,
          nodeCount: document.nodeCount,
          path: resolved,
        },
        false,
        true,
      );
    } catch (error) {
      return ResultFactory.failure(before, EditorError.from(error).diagnostic);
    }
    let outcome: WriteOutcome;
    try {
      outcome = await this.#dependencies.files.replaceUtf8(resolved, source);
      if (!outcome || !['committed', 'not-committed', 'indeterminate'].includes(outcome.status))
        throw new Error('Invalid write outcome');
    } catch {
      return ResultFactory.failure(
        before,
        new EditorError('SAVE_OUTCOME_UNKNOWN', { path: displayPath }).diagnostic,
        'external-unknown',
      );
    }
    if (outcome.status === 'committed') {
      this.#head = next;
      return result;
    }
    if (outcome.status === 'not-committed')
      return ResultFactory.failure(
        before,
        new EditorError('FILE_IO_ERROR', { operation: 'write', path: displayPath }).diagnostic,
      );
    return ResultFactory.failure(
      before,
      new EditorError('SAVE_OUTCOME_UNKNOWN', { path: displayPath }).diagnostic,
      'external-unknown',
    );
  }
  #query(command: QueryCommand, mode: ExecuteMode): ExecutionResult {
    this.#requireCommit(mode);
    const doc = command.requiresDocument ? this.#requireDocument() : null;
    return ResultFactory.commit(this.#head, command.run(doc, this.#dependencies.commands));
  }
  #edit(command: EditCommand, mode: ExecuteMode): ExecutionResult {
    const before = this.#head;
    const document = this.#requireDocument();
    const lease = document.beginEdit();
    let next: SessionHead;
    let result: ExecutionResult;
    try {
      const facts = command.run(document, lease.tx);
      const changes = lease.prepare();
      if (mode === 'dry-run') {
        const result = ResultFactory.preview(before, !changes.isEmpty, changes.describe('forward'));
        lease.rollback();
        return result;
      }
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
      const changes = entry.changes.describe(direction === 'undo' ? 'backward' : 'forward');
      const affectedIds = new Set([
        ...entry.description.targetIds,
        ...changes.flatMap((change) =>
          change.kind === 'placement'
            ? [change.id]
            : change.target.kind === 'shape'
              ? [change.target.id]
              : [],
        ),
      ]);
      result = ResultFactory.commit(
        next,
        {
          kind: 'history',
          direction,
          description: entry.description,
          changes,
          shapes: [...affectedIds].flatMap((id) => {
            const node = document.find(id);
            return node ? [node.describe()] : [];
          }),
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
  #canvas(size: CanvasSize | undefined, mode: ExecuteMode): ExecutionResult {
    this.#requireCommit(mode);
    const before = this.#head;
    const document = this.#requireDocument();
    const original = document.root.size;
    if (!size || (size.width === original.width && size.height === original.height))
      return ResultFactory.commit(before, { kind: 'canvas', size: original });
    const lease = document.beginEdit();
    let next: SessionHead;
    let result: ExecutionResult;
    try {
      document.resizeCanvas(lease.tx, size);
      lease.prepare();
      next = Object.freeze({
        ...before,
        currentStateId: Symbol('state') as StateId,
        history: before.history.afterBarrier('canvas'),
        revision: before.revision + 1,
      });
      result = ResultFactory.commit(next, { kind: 'canvas', size: document.root.size }, true, true);
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
      return this.#poison(this.#head, converted.diagnostic);
    return ResultFactory.failure(this.#head, converted.diagnostic);
  }
  #poison(
    before: SessionHead,
    diagnostic: Diagnostic = new EditorError('INTERNAL_INVARIANT_ERROR').diagnostic,
  ): ExecutionResult {
    if (before.health !== 'poisoned')
      this.#head = Object.freeze({ ...before, health: 'poisoned', revision: before.revision + 1 });
    return ResultFactory.failure(this.#head, diagnostic, 'untrusted');
  }
}
