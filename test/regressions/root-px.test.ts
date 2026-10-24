import { it, expect } from 'vitest';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
it('REG-ROOT-PX-01 retained root SVG lengths normalize through the same schema as child lengths', () => {
  const codec = new XmlSvgCodec();
  const result = codec.decode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" font-size="0px"/>',
    defaultLimits,
  );
  expect(result.semanticRepair).toBe(false);
  expect(result.document.describe().attributes).toContainEqual({ name: 'font-size', value: 0 });
  expect(codec.encode(result.document.describe())).toContain('font-size="0"');
});
