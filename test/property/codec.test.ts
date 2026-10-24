import { expect, it } from 'vitest';
import fc from 'fast-check';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { SvgDocumentBuilder } from '../../src/domain/document/SvgDocumentBuilder.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { PropertyRunner } from '../helpers/PropertyRunner.js';
import { InvariantOracle } from '../helpers/InvariantOracle.js';
import { SemanticSnapshot } from '../helpers/SemanticSnapshot.js';
const codec = new XmlSvgCodec();
it('PROP-07 full semantic roundtrip includes missing attrs, readonly and metadata', () =>
  PropertyRunner.sync(
    'PROP-07',
    fc.property(
      fc.array(
        fc.tuple(
          fc.integer({ min: -100, max: 100 }),
          fc.boolean(),
          fc.constantFrom('', ' 中文🙂  ', '&<>', '\r\n\t', '&amp;'),
        ),
        { minLength: 1, maxLength: 12 },
      ),
      (data) => {
        const builder = new SvgDocumentBuilder(
          defaultLimits,
          { width: 400, height: 300 },
          { fill: 'blue', 'font-size': 18 },
        );
        const g = builder.append('g', 'g', {
          attributes: { 'data-kind': 'box', 'text-anchor': 'middle' },
        });
        builder.append(
          'circle',
          'circle',
          { attributes: { cx: data[0]![0], r: 0, 'stroke-width': 2 } },
          g.asContainer()!,
        );
        builder.append('ellipse', 'ellipse', { attributes: { rx: 2, ry: 3 } }, g.asContainer()!);
        builder.append(
          'line',
          'line',
          { attributes: { x1: data[0]![0], y1: -2, x2: 3, y2: 4, stroke: 'none' } },
          g.asContainer()!,
        );
        for (const [i, [x, explicit, text]] of data.entries()) {
          builder.append(
            'rect',
            `r${i}`,
            {
              attributes: {
                ...(i % 2 ? { x } : {}),
                width: 3,
                height: 4,
                ...(explicit ? { fill: 'black' } : {}),
              },
            },
            g.asContainer()!,
          );
          builder.append(
            'text',
            `t${i}`,
            { attributes: { x, 'font-size': 0 }, text },
            g.asContainer()!,
          );
        }
        const original = builder.build();
        const encoded = codec.encode(original.describe());
        const decoded = codec.decode(encoded, defaultLimits);
        expect(decoded.semanticRepair).toBe(false);
        expect(decoded.warnings).toEqual([]);
        expect(SemanticSnapshot.of(decoded.document.describe())).toEqual(
          SemanticSnapshot.of(original.describe()),
        );
        expect(decoded.document.documentId).not.toBe(original.documentId);
        InvariantOracle.check(decoded.document);
      },
    ),
  ));
it('PROP-08 normalization idempotent and first semantics independently known', () =>
  PropertyRunner.sync(
    'PROP-08',
    fc.property(
      fc.constantFrom(
        ['  A &amp; B  ', '  A & B  '],
        ['<![CDATA[< &>]]>', '< &>'],
        ['&#xD;\n🙂', '\r\n🙂'],
      ),
      fc.boolean(),
      ([raw, text], prefixed) => {
        const root = prefixed ? 's:svg' : 'svg';
        const child = prefixed ? 's:text' : 'text';
        const namespace = prefixed ? 'xmlns:s' : 'xmlns';
        const source = `<${root} ${namespace}="http://www.w3.org/2000/svg" width="4e2px" height="300" viewBox="0,0,400,300"><${child} id="t">${raw}</${child}><!-- layout --></${root}>`;
        const first = codec.decode(source, defaultLimits);
        expect(first.document.require('t').describe().text).toBe(text);
        const normalized = codec.encode(first.document.describe());
        expect(codec.encode(codec.decode(normalized, defaultLimits).document.describe())).toBe(
          normalized,
        );
      },
    ),
  ));
it('PROP-11 two-pass IDs skip global explicit reservation independent of earlier failure', () =>
  PropertyRunner.sync(
    'PROP-11',
    fc.property(fc.integer({ min: 1, max: 5 }), (reserved) => {
      const root = (body: string) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${body}</svg>`;
      const source = root(
        `<rect width="1" height="1"/><rect width="1" height="1"/><rect width="1" height="1"/><circle id="rect${reserved}" r="1"/>`,
      );
      const first = codec.decode(source, defaultLimits);
      expect(() =>
        codec.decode(root('<rect width="1" height="1"/><circle r="-1"/>'), defaultLimits),
      ).toThrow();
      const second = codec.decode(source, defaultLimits);
      const expected = [1, 2, 3, 4, 5]
        .filter((n) => n !== reserved)
        .slice(0, 3)
        .map((n) => `rect${n}`);
      expect(second.document.root.childrenSnapshot().map((n) => n.id)).toEqual([
        ...expected,
        `rect${reserved}`,
      ]);
      expect(second.warnings.map((w) => w.parameters.id)).toEqual(expected);
      expect(second.warnings).toEqual(first.warnings);
      expect(second.semanticRepair).toBe(true);
      InvariantOracle.check(second.document);
    }),
  ));
