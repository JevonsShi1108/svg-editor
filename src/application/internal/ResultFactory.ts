import type { SessionHead } from './protocols.js';
import type { SessionStatus, ResultData, ExecutionResult, Diagnostic } from '../contracts/api.js';
import { FrozenValue } from './FrozenValue.js';
export class ResultFactory {
  static preview(
    head: SessionHead,
    wouldChange: boolean,
    preview: readonly unknown[],
  ): ExecutionResult {
    return FrozenValue.freeze({
      ok: true as const,
      mode: 'dry-run' as const,
      wouldChange,
      preview,
      warnings: [],
      status: this.status(head),
    });
  }
  static status(head: SessionHead): SessionStatus {
    return Object.freeze({
      state: head.health === 'poisoned' ? 'poisoned' : head.document ? 'ready' : 'empty',
      revision: head.revision,
      currentPath: head.currentPath,
      dirty:
        head.health === 'poisoned'
          ? null
          : head.document
            ? head.savedStateId === null || head.currentStateId !== head.savedStateId
            : false,
      history: head.history.inspect(),
    });
  }
  static commit(
    head: SessionHead,
    data: ResultData,
    contentChanged = false,
    sessionChanged = false,
    warnings: readonly Diagnostic[] = [],
  ): ExecutionResult {
    return FrozenValue.freeze({
      ok: true as const,
      mode: 'commit' as const,
      contentChanged,
      sessionChanged,
      data,
      warnings,
      status: this.status(head),
    });
  }
  static failure(
    head: SessionHead,
    error: Diagnostic,
    effect: 'unchanged' | 'external-unknown' | 'untrusted' = 'unchanged',
  ): ExecutionResult {
    return FrozenValue.freeze({ ok: false as const, error, effect, status: this.status(head) });
  }
}
