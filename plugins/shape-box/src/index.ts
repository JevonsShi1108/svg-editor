import type { Plugin } from '@svgframe/api';
import { BoxProvider } from './BoxProvider.js';
import { BoxAttributes } from './BoxAttributes.js';
export default {
  activate(context) {
    context.registerShape(new BoxProvider());
    context.registerAttribute(new BoxAttributes());
  },
} satisfies Plugin;
