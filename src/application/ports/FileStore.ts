declare const pathBrand: unique symbol;
export type FilePath = string & { readonly [pathBrand]: true };
export interface FileFailure {
  readonly operation: 'read' | 'write';
  readonly path: string;
  readonly stage: string;
  readonly cause?: unknown;
  readonly cleanupError?: unknown;
  readonly temporaryPath?: string;
}
export type WriteOutcome =
  | { readonly status: 'committed' }
  | { readonly status: 'not-committed' | 'indeterminate'; readonly error: FileFailure };
export interface FileStore {
  resolve(path: string): FilePath;
  readUtf8(path: FilePath, maxBytes: number): Promise<string>;
  replaceUtf8(path: FilePath, source: string): Promise<WriteOutcome>;
}
