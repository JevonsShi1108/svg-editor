import path from 'node:path';
import {
  readdirSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from 'node:fs';

// Keep dist/main.js and each workspace package's main stable across production builds.
function publish(source, target) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      publish(path.join(source, entry.name), path.join(target, entry.name));
      continue;
    }
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue;
    mkdirSync(target, { recursive: true });
    const base = entry.name.slice(0, -3);
    for (const suffix of ['.js', '.d.ts', '.js.map']) {
      const compiled = path.resolve('artifacts/cli-build', source, base + suffix);
      const output = path.join(target, base + suffix);
      if (suffix !== '.js.map') copyFileSync(compiled, output);
      else {
        const map = JSON.parse(readFileSync(compiled, 'utf8'));
        map.sources = [path.relative(target, path.join(source, entry.name)).replaceAll('\\', '/')];
        writeFileSync(output, JSON.stringify(map));
      }
    }
  }
}
publish('src', 'dist');
if (existsSync('plugins'))
  for (const entry of readdirSync('plugins', { withFileTypes: true })) {
    if (entry.isDirectory())
      publish(path.join('plugins', entry.name, 'src'), path.join('plugins', entry.name, 'dist'));
  }
