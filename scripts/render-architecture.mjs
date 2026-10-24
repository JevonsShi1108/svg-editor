import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const version = '1.2026.8';
const jarSha256 = '5e1ecfa8ecd32c90b03bbf3b1eb6f020943f98ab0fcf4032be31a0002ee2c462';
const jar = `artifacts/tools/plantuml-${version}.jar`;
const url = `https://github.com/plantuml/plantuml/releases/download/v${version}/plantuml-${version}.jar`;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Match the repository's LF checkout contract before rendering and hashing the source.
writeFileSync(
  'doc/architecture.puml',
  readFileSync('doc/architecture.puml', 'utf8').replace(/\r\n?/g, '\n'),
);
mkdirSync('artifacts/tools', { recursive: true });
if (!existsSync(jar)) {
  const response = await globalThis.fetch(url);
  if (!response.ok) throw new Error(`PlantUML download HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== jarSha256) throw new Error('PlantUML download digest mismatch');
  writeFileSync(jar, bytes);
}
if (hash(readFileSync(jar)) !== jarSha256) throw new Error('PlantUML jar digest mismatch');
const result = spawnSync(
  'java',
  ['-Djava.awt.headless=true', '-jar', jar, '-tsvg', '-failfast2', 'doc/architecture.puml'],
  { encoding: 'utf8' },
);
if (result.error || result.status !== 0) throw new Error(result.error?.message ?? result.stderr);
const png = spawnSync('java', ['-Djava.awt.headless=true', '-jar', jar, '-tpng', '-pipe'], {
  input: readFileSync('doc/architecture.puml'),
  maxBuffer: 8 * 1024 * 1024,
});
if (png.error || png.status !== 0) throw new Error(png.error?.message ?? png.stderr.toString());
mkdirSync('artifacts/preview', { recursive: true });
writeFileSync('artifacts/preview/architecture.png', png.stdout);
writeFileSync(
  'doc/architecture.meta.json',
  JSON.stringify(
    {
      tool: 'PlantUML',
      version,
      url,
      jarSha256,
      source: 'doc/architecture.puml',
      sourceSha256: hash(readFileSync('doc/architecture.puml')),
      output: 'doc/architecture.svg',
      outputSha256: hash(readFileSync('doc/architecture.svg')),
      layout: 'smetana',
      command: 'npm run doc:diagram',
    },
    null,
    2,
  ) + '\n',
);
console.log('Rendered actual PlantUML package/component diagram: doc/architecture.svg');
