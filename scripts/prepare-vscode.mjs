import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export function prepareFixture(destination) {
  mkdirSync(destination, { recursive: true });
  cpSync(path.resolve('extensions/svg-tools/example'), destination, { recursive: true });
}

if (import.meta.main) prepareFixture(path.resolve('artifacts/ui/development'));
