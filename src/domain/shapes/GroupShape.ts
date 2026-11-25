import { ContainerShape } from './ContainerShape.js';
import { ShapeSchema } from './ShapeSchema.js';
import type { DocumentId, OwnState } from '../values/contracts.js';
import type { ValueRules } from '../values/ValueRules.js';
export class GroupShape extends ContainerShape {
  static readonly schema = new ShapeSchema('g', {}, [], 'container', [], undefined, true);
  constructor(id: string, owner: DocumentId, rules: ValueRules, state: OwnState) {
    super(id, owner, rules, GroupShape.schema, state);
  }
}
