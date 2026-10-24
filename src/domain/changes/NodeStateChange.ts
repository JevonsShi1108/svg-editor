import { Change } from './Change.js';
import type { StateTarget, ReplayWriter } from '../internal/protocols.js';
import type { NodeMemento } from '../values/NodeMemento.js';
import type { Direction } from '../values/contracts.js';
export class NodeStateChange extends Change {
  constructor(
    readonly target: StateTarget,
    readonly before: NodeMemento,
    readonly after: NodeMemento,
  ) {
    super();
    Object.freeze(this);
  }
  override replayUsing(writer: ReplayWriter, direction: Direction): void {
    writer.state(
      this.target,
      direction === 'forward' ? this.before : this.after,
      direction === 'forward' ? this.after : this.before,
    );
  }
  override describe(direction: Direction): unknown {
    return Object.freeze({
      kind: 'state',
      before: this.target.describeState(direction === 'forward' ? this.before : this.after),
      after: this.target.describeState(direction === 'forward' ? this.after : this.before),
    });
  }
}
