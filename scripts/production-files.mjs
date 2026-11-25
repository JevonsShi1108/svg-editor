import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

export function filesUnder(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.posix.join(directory, entry.name);
    return entry.isDirectory()
      ? ['dist', 'node_modules'].includes(entry.name)
        ? []
        : filesUnder(file)
      : [file];
  });
}
export const cliSources = () =>
  [
    ...filesUnder('src'),
    ...filesUnder('plugins').filter((p) => /^plugins\/[^/]+\/src\//.test(p)),
    ...filesUnder('packages/api'),
  ]
    .filter((p) => /\.(?:js|ts)$/.test(p))
    .sort();
export const extensionSources = () =>
  filesUnder('extensions/svg-tools/src')
    .filter((p) => p.endsWith('.ts'))
    .sort();
