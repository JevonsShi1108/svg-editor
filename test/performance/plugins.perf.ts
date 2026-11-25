import { expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SvgOutline } from '../../extensions/svg-tools/src/SvgOutline.js';
import { ModifiedStar } from '../../plugins/tree-star/src/ModifiedStar.js';
import type { DocumentDescription } from '@svgframe/api';
it('measures outline offsets and decoration preparation at 100, 1000 and 5000 children', () => {
  const report = [];
  for (const size of [100, 1000, 5000]) {
    const children = Array.from({ length: size }, (_, i) => ({
      shape: { id: 'r' + i, type: 'rect', attributes: [], displayFields: [] },
      children: [],
    }));
    const saved: DocumentDescription = { size: { width: 1, height: 1 }, attributes: [], children };
    const changed = { ...saved, children: children.slice(1) };
    const star = new ModifiedStar();
    star.checkpoint(saved, []);
    const xml =
        '<svg>' + children.map((n) => '<rect id="' + n.shape.id + '"/>').join('') + '</svg>',
      outline = new SvgOutline();
    for (const [operation, work] of [
      [
        'outline',
        () => {
          const nodes = outline.parse(xml);
          expect(nodes.length).toBe(size + 1);
          expect(nodes.at(-1)?.name).toBe('rect#r' + (size - 1));
        },
      ],
      [
        'tree',
        () => {
          const label = star.prepare(changed);
          expect(label(null)).toBe('*');
          expect(changed.children.every((n) => label(n) === undefined)).toBe(true);
        },
      ],
    ] as const) {
      work();
      const samples = Array.from({ length: 11 }, () => {
        const start = performance.now();
        work();
        return performance.now() - start;
      }).sort((a, b) => a - b);
      report.push({ size, operation, medianMs: samples[5], p95Ms: samples[10] });
    }
  }
  mkdirSync('artifacts/performance', { recursive: true });
  writeFileSync('artifacts/performance/phase2.json', JSON.stringify(report, null, 2));
});
