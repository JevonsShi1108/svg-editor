import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
export const sourceDigest = () => {
  const files = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : [path.join(directory, entry.name)],
    );
  const hash = createHash('sha256');
  for (const file of files('src')
    .filter((f) => f.endsWith('.ts'))
    .sort())
    hash
      .update(file.replaceAll('\\', '/') + '\0')
      .update(readFileSync(file))
      .update('\0');
  return hash.digest('hex');
};
