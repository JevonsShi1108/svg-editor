import type { ResourceLimits } from './contracts.js';
export const defaultLimits: ResourceLimits = Object.freeze({
  maxSvgBytes: 10 * 1024 * 1024,
  maxNodeCount: 10000,
  maxTreeDepth: 64,
  maxTextLength: 100000,
  maxAttributeLength: 4096,
});
