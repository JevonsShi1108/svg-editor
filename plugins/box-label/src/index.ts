import type { Plugin } from '@svgframe/api';
import { BoxTypeLabel } from './BoxTypeLabel.js';
export default {
  activate(context) {
    context.registerDecorator(new BoxTypeLabel());
  },
} satisfies Plugin;
