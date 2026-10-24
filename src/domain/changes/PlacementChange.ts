import { Change } from './Change.js';
import type { Shape } from '../shapes/Shape.js';
import type { Placement, ReplayWriter } from '../internal/protocols.js';
import type { Direction, ChangeDescription } from '../values/contracts.js';
export class PlacementChange extends Change {
  readonly from: Placement | null;
  readonly to: Placement | null;
  constructor(
    readonly node: Shape,
    from: Placement | null,
    to: Placement | null,
  ) {
    super();
    this.from = from ? Object.freeze({ ...from }) : null;
    this.to = to ? Object.freeze({ ...to }) : null;
    Object.freeze(this);
  }
  override replayUsing(writer: ReplayWriter, direction: Direction): void {
    writer.placement(
      this.node,
      direction === 'forward' ? this.from : this.to,
      direction === 'forward' ? this.to : this.from,
    );
  }
  override describe(direction: Direction): ChangeDescription {
    const describe = (p: Placement | null) =>
      p ? Object.freeze({ parent: p.parent.ownerShape?.id ?? null, index: p.index }) : null;
    return Object.freeze({
      kind: 'placement',
      id: this.node.id,
      from: describe(direction === 'forward' ? this.from : this.to),
      to: describe(direction === 'forward' ? this.to : this.from),
    });
  }
}
