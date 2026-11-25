import { expect, it } from 'vitest';
import { StatsCommand } from '../../plugins/stats/src/StatsCommand.js';
import type { TreeNodeDescription } from '@svgframe/api';
it('counts leaves in first-encounter DFS order including custom and empty containers', () => {
  const node = (type: string, ...children: TreeNodeDescription[]): TreeNodeDescription => ({
    shape: { id: 'x', type, attributes: [], displayFields: [] },
    children,
  });
  const count = (...children: TreeNodeDescription[]) =>
    new StatsCommand().run({
      document: { size: { width: 1, height: 1 }, attributes: [], children },
      isContainer: (type) => ['group', 'pair'].includes(type),
    });
  expect(count()).toEqual(['(total 0, containers 0)']);
  expect(count(node('group'), node('pair', node('z'), node('a')), node('a'), node('z'))).toEqual([
    'z: 2  a: 2  (total 4, containers 2)',
  ]);
  expect(count(node('a'), node('pair', node('z')))).toEqual([
    'a: 1  z: 1  (total 2, containers 1)',
  ]);
});
