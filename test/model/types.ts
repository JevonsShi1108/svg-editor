import type {
  CommandRequest,
  ExecuteOptions,
  Diagnostic,
  SessionStatus,
} from '../../src/application/contracts/api.js';
export interface FlatNode {
  uid: number;
  id: string;
  type: string;
  attributes: Record<string, string | number>;
  text?: string;
  parent: number | null;
  children: number[];
}
export interface ModelDocument {
  width: number;
  height: number;
  attributes: Record<string, string | number>;
  nodes: Record<number, FlatNode>;
  root: number[];
}
export interface SnapshotEntry {
  before: ModelDocument;
  after: ModelDocument;
  beforeToken: number;
  afterToken: number;
}
export interface ModelFile {
  document: ModelDocument | null;
  repair: boolean;
}
export interface ModelState {
  document: ModelDocument | null;
  documentToken: number;
  currentToken: number | null;
  savedToken: number | null;
  currentPath: string | null;
  revision: number;
  barrier: 'init' | 'read' | 'save' | 'canvas' | null;
  undo: SnapshotEntry[];
  redo: SnapshotEntry[];
  nextUid: number;
  nextToken: number;
  files: Record<string, ModelFile>;
}
export interface ModelStep {
  request: CommandRequest;
  options?: ExecuteOptions;
  outcome?: 'committed' | 'not-committed' | 'indeterminate';
  physical?: boolean;
}
export interface Prediction {
  ok: boolean;
  mode?: 'commit' | 'dry-run';
  error?: string;
  effect?: 'unchanged' | 'external-unknown';
  contentChanged?: boolean;
  sessionChanged?: boolean;
  wouldChange?: boolean;
  warnings?: readonly Diagnostic[];
}
export interface Transition {
  state: ModelState;
  result: Prediction;
}
export interface ModelContainer {
  state: ModelState;
}
export interface ComparableTree {
  type: string;
  id: string;
  attributes: Record<string, string | number>;
  text?: string;
  children: ComparableTree[];
}
export interface ComparableDocument {
  size: { width: number; height: number };
  attributes: Record<string, string | number>;
  children: ComparableTree[];
}
export type PublicStatus = SessionStatus;
