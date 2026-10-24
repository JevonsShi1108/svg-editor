import type { ReplayWriter } from '../internal/protocols.js';
import type { Direction } from '../values/contracts.js';
export abstract class Change {
  abstract replayUsing(writer: ReplayWriter, direction: Direction): void;
  abstract describe(direction: Direction): unknown;
}
