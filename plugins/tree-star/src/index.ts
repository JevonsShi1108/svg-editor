import type { Plugin } from '@svgframe/api';
import { ModifiedStar } from './ModifiedStar.js';
export default {
  activate(context) {
    context.registerDecorator(new ModifiedStar());
  },
} satisfies Plugin;
