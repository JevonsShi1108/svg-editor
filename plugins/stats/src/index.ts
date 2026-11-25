import type { Plugin } from '@svgframe/api';
import { StatsCommand } from './StatsCommand.js';
export default {
  activate(context) {
    context.registerCommand(new StatsCommand());
  },
} satisfies Plugin;
