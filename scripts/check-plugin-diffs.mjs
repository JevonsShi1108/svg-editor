import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trimEnd();
const resolve = (ref) => git('rev-parse', '--verify', ref + '^{commit}');
const head = resolve(process.argv[2] ?? 'HEAD');
const specs = [
  ['39db6e3', 'stats', 'code'],
  ['de17638', 'dir', 'code'],
  ['1f37244fb9f2c60d0271fd93889a24595928dabe', 'shape-box', 'code'],
  ['bd981ac204470e58589c96832ccf4945a133a873', 'shape-box', 'config'],
  ['ffa4ccc', 'box-label', 'both'],
  ['b729e71', 'tree-star', 'both'],
];
const out = 'artifacts/plugin-diffs';
mkdirSync(out, { recursive: true });
const proofs = [];
for (const [ref, dir, mode] of specs) {
  const commit = resolve(ref),
    parent = resolve(commit + '^'),
    prefix = 'plugins/' + dir + '/';
  git('merge-base', '--is-ancestor', commit, head);
  assert.equal(git('ls-tree', '-r', '--name-only', parent, '--', prefix), '');
  const files = git('diff', '--no-renames', '--name-status', parent, commit)
    .split('\n')
    .map((line) => line.split('\t'));
  const oldPlugins = git('ls-tree', '-d', '--name-only', parent, '--', 'plugins')
    ? git('ls-tree', '-d', '--name-only', parent + ':plugins')
        .split('\n')
        .filter(Boolean)
    : [];
  const protectedPaths = [
    'src/cli',
    'src/application',
    'src/domain',
    'src/infrastructure',
    'src/host/loader',
    'packages/api',
    ...oldPlugins.map((p) => 'plugins/' + p),
  ];
  for (const folder of protectedPaths)
    for (const rev of [parent, commit])
      assert.ok(git('ls-tree', '-r', '--name-only', rev, '--', folder).length, folder);
  assert.equal(git('diff', parent, commit, '--', ...protectedPaths), '');
  for (const [status, file] of files) {
    if (file.startsWith(prefix)) assert.equal(status, 'A');
    else if (file === 'src/host/code-profile.ts') assert.ok(mode !== 'config');
    else if (file === 'plugins.config.json') assert.ok(mode !== 'code');
    else assert.ok(file === 'package-lock.json' || /^(test|doc)\//.test(file), file);
  }
  assert.equal(
    files.some(([, p]) => p === 'src/host/code-profile.ts'),
    mode !== 'config',
  );
  assert.equal(
    files.some(([, p]) => p === 'plugins.config.json'),
    mode !== 'code',
  );
  assert.ok(files.some(([, p]) => p === prefix + 'src/index.ts'));
  const manifest = JSON.parse(git('show', commit + ':' + prefix + 'package.json'));
  assert.equal(manifest.main, './dist/index.js');
  assert.equal(manifest.scripts, undefined);
  const lock = (rev) => JSON.parse(git('show', rev + ':package-lock.json'));
  const oldLock = lock(parent),
    newLock = lock(commit);
  assert.deepEqual(newLock.packages['node_modules/' + manifest.name], {
    resolved: 'plugins/' + dir,
    link: true,
  });
  assert.equal(newLock.packages['plugins/' + dir].version, manifest.version);
  delete newLock.packages['node_modules/' + manifest.name];
  delete newLock.packages['plugins/' + dir];
  assert.deepEqual(newLock, oldLock);
  if (mode !== 'code') {
    const cfg = (rev) => JSON.parse(git('show', rev + ':plugins.config.json')).plugins;
    assert.deepEqual(cfg(commit), [...cfg(parent), { module: './plugins/' + dir }]);
  }
  const tree = git('rev-parse', commit + ':plugins/' + dir);
  const diff = git(
    'diff',
    '--no-renames',
    parent,
    commit,
    '--',
    'src',
    'packages',
    'plugins',
    ':(exclude)' + prefix + '**',
    ...(mode === 'config' ? [] : [':(exclude)src/host/code-profile.ts']),
  );
  assert.equal(diff, '');
  proofs.push({ dir, mode, commit, parent, tree, protectedPaths, files });
}
const ab = proofs.filter((p) => p.dir === 'shape-box');
assert.equal(ab[0].parent, ab[1].parent);
assert.equal(ab[0].tree, ab[1].tree);
writeFileSync(out + '/latest.json', JSON.stringify({ head, proofs }, null, 2) + '\n');
console.log('Verified ' + proofs.length + ' integration diffs; shared box tree ' + ab[0].tree);
