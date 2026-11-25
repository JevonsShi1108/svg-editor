import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cliSources, extensionSources, filesUnder } from './production-files.mjs';
export const sourceDigest = () => {
  const files = [
    ...cliSources(),
    ...extensionSources(),
    'extensions/svg-tools/package.json',
    'packages/api/package.json',
    'plugins.config.json',
    ...filesUnder('plugins').filter((p) => /^plugins\/[^/]+\/package\.json$/.test(p)),
  ].sort();
  const hash = createHash('sha256');
  for (const file of files)
    hash
      .update(file + '\0')
      .update(readFileSync(file, 'utf8').replaceAll('\r\n', '\n'))
      .update('\0');
  return hash.digest('hex');
};
