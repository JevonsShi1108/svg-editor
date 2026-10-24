import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DOMParser } from '@xmldom/xmldom';
import { sourceDigest } from './source-digest.mjs';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const examples = [];
mkdirSync('artifacts/preview', { recursive: true });
for (const [name, ids] of [
  [
    'flowchart',
    ['flowchart', 'node1', 'start', 'start-label', 'node2', 'process', 'process-label', 'arrow1'],
  ],
  ['gallery', ['background', 'panel', 'card', 'orb', 'oval', 'edge', 'label', 'empty']],
]) {
  const script = `doc/examples/${name}.txt`,
    artifact = `doc/examples/${name}.svg`;
  const result = spawnSync(process.execPath, ['dist/main.js'], {
    input: readFileSync(script),
    encoding: 'utf8',
  });
  writeFileSync(`artifacts/preview/${name}.log`, `${result.stdout ?? ''}${result.stderr ?? ''}`);
  if (result.error || result.status !== 0 || result.stderr)
    throw new Error(`Example ${name}: ${result.error?.message ?? result.stderr}`);
  const bytes = readFileSync(artifact);
  const document = new DOMParser().parseFromString(bytes.toString('utf8'), 'image/svg+xml');
  const actual = Array.from(document.getElementsByTagName('*'))
    .slice(1)
    .map((e) => e.getAttribute('id'));
  if (JSON.stringify(actual) !== JSON.stringify(ids))
    throw new Error(`Unexpected hand-written example ID order ${name}`);
  examples.push({
    script,
    scriptSha256: hash(readFileSync(script)),
    artifact,
    artifactSha256: hash(bytes),
    nodeCount: actual.length,
  });
}
writeFileSync(
  'doc/examples/evidence.json',
  JSON.stringify(
    {
      sourceSha256: sourceDigest(),
      lockSha256: hash(readFileSync('package-lock.json')),
      node: process.version,
      command: 'npm run doc:examples',
      examples,
    },
    null,
    2,
  ) + '\n',
);
console.log('Actual CLI saved/read two 8-node examples; hand-written preorder IDs match.');
