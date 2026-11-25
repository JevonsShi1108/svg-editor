import type { Plugin } from '@svgframe/api';
import { DirCommand } from './DirCommand.js';
import { NodeDirectoryReader } from './NodeDirectoryReader.js';
export default {
  activate(context) {
    context.registerCommand(new DirCommand(new NodeDirectoryReader(), context.cwd));
  },
} satisfies Plugin;
