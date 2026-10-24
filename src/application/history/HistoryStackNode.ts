import type { HistoryEntry } from './HistoryEntry.js';
export class HistoryStackNode {
  readonly size: number;
  constructor(
    readonly entry: HistoryEntry,
    readonly next: HistoryStackNode | null,
  ) {
    this.size = (next?.size ?? 0) + 1;
    Object.freeze(this);
  }
}
