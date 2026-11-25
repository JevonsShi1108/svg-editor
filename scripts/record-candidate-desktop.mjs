import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [version, window, line, symbol, badge] = process.argv.slice(2);
assert.ok(
  version && window?.includes('Extension Development Host'),
  'Supply the observed version and exact development window title.',
);
assert.equal(line, '3');
assert.equal(symbol, 'rect#start');
assert.equal(badge, '[]');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
assert.equal(git('status', '--porcelain'), '', 'Use the clean exact candidate checkout.');
const hash = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const folder = 'artifacts/desktop-candidate';
const images = Object.fromEntries(
  ['badge', 'outline'].map((name) => {
    const file = folder + '/' + name + '.jpg';
    assert.equal(
      readFileSync(file).readUInt16BE(0),
      0xffd8,
      'Expected a JPEG window capture at ' + file,
    );
    return [name, { file, sha256: hash(file) }];
  }),
);
assert.notEqual(images.badge.sha256, images.outline.sha256);
const fixture = path.join(folder, 'fixture', 'example.svg');
assert.equal(hash(fixture), hash('extensions/svg-tools/example/example.svg'));
const receipt = {
  candidate: git('rev-parse', 'HEAD'),
  checkout: process.cwd(),
  observedAt: new Date().toISOString(),
  version,
  window,
  line: Number(line),
  symbol,
  badge,
  extensionSha256: hash('extensions/svg-tools/dist/extension.cjs'),
  fixtureSha256: hash(fixture),
  images,
};
writeFileSync(folder + '/receipt.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(receipt.candidate, folder + '/receipt.json');
