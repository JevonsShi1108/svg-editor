import type {
  CanvasSize,
  ShapeCreation,
  DocumentDescription,
  ShapeDescription,
  TreeNodeDescription,
  ChangePreview,
} from '../../domain/values/contracts.js';
import type { HistoryStatus, OperationDescription } from './history.js';
export type EditRequest =
  | { readonly command: 'create'; readonly shape: ShapeCreation; readonly parentId?: string }
  | { readonly command: 'delete' | 'front' | 'back'; readonly id: string }
  | { readonly command: 'move'; readonly id: string; readonly dx: number; readonly dy: number }
  | { readonly command: 'scale'; readonly id: string; readonly factor: number }
  | {
      readonly command: 'set';
      readonly id: string;
      readonly attribute: string;
      readonly value: string | number;
    }
  | { readonly command: 'group'; readonly newId: string; readonly ids: readonly string[] }
  | { readonly command: 'ungroup'; readonly id: string }
  | { readonly command: 'addto'; readonly containerId: string; readonly id: string };
export type CommandRequest =
  | EditRequest
  | { readonly command: 'init'; readonly size?: CanvasSize }
  | { readonly command: 'read'; readonly path: string }
  | { readonly command: 'save'; readonly path?: string }
  | { readonly command: 'canvas'; readonly size?: CanvasSize }
  | { readonly command: 'tree'; readonly id?: string }
  | { readonly command: 'show'; readonly id: string }
  | { readonly command: 'help' }
  | { readonly command: 'undo' | 'redo' };
export interface ExecuteOptions {
  readonly mode?: 'commit' | 'dry-run';
}
export interface InputToken {
  readonly value: string;
  readonly start: number;
  readonly end: number;
  readonly quoted: boolean;
}
export interface CommandHelp {
  readonly name: string;
  readonly syntax: string;
  readonly description: string;
}
export interface CommandParser {
  parse(tokens: readonly InputToken[]): CommandRequest;
  describe(): readonly CommandHelp[];
}
export interface Diagnostic {
  readonly code: string;
  readonly parameters: Readonly<Record<string, string | number>>;
}
export interface SessionStatus {
  readonly state: 'empty' | 'ready' | 'poisoned';
  readonly revision: number;
  readonly currentPath: string | null;
  readonly dirty: boolean | null;
  readonly history: HistoryStatus;
}
export interface EditFacts {
  readonly action: string;
  readonly operation: string;
  readonly targetIds: readonly string[];
  readonly shapes: readonly ShapeDescription[];
  readonly details?: Readonly<Record<string, string | number>>;
}
export type ResultData =
  | { readonly kind: 'edit'; readonly facts: EditFacts }
  | {
      readonly kind: 'tree';
      readonly document?: DocumentDescription;
      readonly node?: TreeNodeDescription;
    }
  | {
      readonly kind: 'show';
      readonly shape: ShapeDescription;
      readonly parent: { readonly kind: 'root' } | { readonly kind: 'group'; readonly id: string };
    }
  | { readonly kind: 'canvas'; readonly size: CanvasSize }
  | {
      readonly kind: 'document';
      readonly operation: 'init' | 'read' | 'save';
      readonly size: CanvasSize;
      readonly nodeCount: number;
      readonly path?: string;
    }
  | {
      readonly kind: 'history';
      readonly direction: 'undo' | 'redo';
      readonly description: OperationDescription;
      readonly changes: ChangePreview;
      readonly shapes: readonly ShapeDescription[];
    }
  | { readonly kind: 'help'; readonly commands: readonly CommandHelp[] };
export type ExecutionResult =
  | {
      readonly ok: true;
      readonly mode: 'commit';
      readonly contentChanged: boolean;
      readonly sessionChanged: boolean;
      readonly data: ResultData;
      readonly warnings: readonly Diagnostic[];
      readonly status: SessionStatus;
    }
  | {
      readonly ok: true;
      readonly mode: 'dry-run';
      readonly wouldChange: boolean;
      readonly preview: ChangePreview;
      readonly warnings: readonly Diagnostic[];
      readonly status: SessionStatus;
    }
  | {
      readonly ok: false;
      readonly error: Diagnostic;
      readonly effect: 'unchanged' | 'external-unknown' | 'untrusted';
      readonly status: SessionStatus;
    };
export interface SessionExecutor {
  execute(request: CommandRequest, options?: ExecuteOptions): Promise<ExecutionResult>;
}
