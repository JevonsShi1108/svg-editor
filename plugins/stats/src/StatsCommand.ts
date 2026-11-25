import type { Command, QueryContext } from '@svgframe/api';
import { EditorError } from '@svgframe/api';

export class StatsCommand implements Command {
  readonly help = { name: 'stats', syntax: 'stats', description: 'Count leaves and containers' };
  readonly arity = [0, 0] as const;
  readonly requiresDocument = true;
  run(context: QueryContext) {
    if (!context.document) throw new EditorError('NO_DOCUMENT');
    const counts = new Map<string, number>();
    let total = 0,
      containers = 0;
    const pending = [...context.document.children].reverse();
    while (pending.length) {
      const node = pending.pop()!;
      if (context.isContainer(node.shape.type)) {
        containers++;
        for (let i = node.children.length - 1; i >= 0; i--) pending.push(node.children[i]!);
      } else {
        counts.set(node.shape.type, (counts.get(node.shape.type) ?? 0) + 1);
        total++;
      }
    }
    return [
      [
        ...Array.from(counts, ([type, n]) => type + ': ' + n),
        `(total ${total}, containers ${containers})`,
      ].join('  '),
    ];
  }
}
