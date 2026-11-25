import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  unlinkSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { DOMParser } from '@xmldom/xmldom';

const root = process.cwd(),
  main = path.resolve('dist/main.js'),
  sha = (b) => createHash('sha256').update(b).digest('hex');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const final = git(['rev-parse', 'final^{commit}']);
assert.equal(final, '667fa6efcfe074697aec595ed6f4e6a146b616c1');
const baseline = path.resolve('.candidate', 'p2-transcript-final');
mkdirSync(path.dirname(baseline), { recursive: true });
if (!existsSync(baseline)) {
  git(['clone', '--quiet', '--no-checkout', '--shared', '--', root, baseline]);
  git(['checkout', '--detach', final], baseline);
}
assert.equal(git(['rev-parse', 'HEAD'], baseline), final);
assert.equal(git(['status', '--porcelain'], baseline), '');
const logs = path.resolve('artifacts/assemblies');
mkdirSync(logs, { recursive: true });
const run = mkdtempSync(path.join(logs, 'run-'));
for (const [name, args] of [
  ['ci', ['ci', '--no-audit', '--no-fund']],
  ['build', ['run', 'build']],
]) {
  const res = spawnSync(process.execPath, [process.env.npm_execpath, ...args], { cwd: baseline });
  writeFileSync(
    path.join(run, 'baseline-' + name + '.log'),
    Buffer.concat([res.stdout, res.stderr]),
  );
  assert.equal(res.status, 0, 'baseline ' + name);
}
const cwd = path.join(run, 'cwd');
mkdirSync(cwd);
const baseConfig = path.resolve('doc/transcript/base.config.json'),
  demoConfig = path.resolve('plugins.config.json'),
  boxConfig = path.resolve('doc/transcript/box.config.json');
const profile = (name, args, entry = main) => ({ name, args, entry });
const old = profile('final', [], path.join(baseline, 'dist/main.js'));
const a = profile('code', ['--preset', 'base']),
  b = profile('config', ['--config', baseConfig]);
const demo = [profile('code', ['--preset', 'demo']), profile('config', ['--config', demoConfig])];
const box = [profile('code', ['--preset', 'box']), profile('config', ['--config', boxConfig])];
const read = (name) => readFileSync(path.join('doc/transcript', name));
const records = [];
function equalBytes(label, left, right) {
  if (left.equals(right)) return;
  let offset = 0;
  while (offset < left.length && offset < right.length && left[offset] === right[offset]) offset++;
  throw Error(
    `${label}: mismatch at byte ${offset}; ${left.subarray(offset, offset + 32).toString('hex')} / ${right.subarray(offset, offset + 32).toString('hex')}; raw files in ${run}`,
  );
}
assert.throws(
  () => equalBytes('byte sensitivity', Buffer.from([32, 10]), Buffer.from([32, 13])),
  /mismatch at byte 1/,
);
function compare(name, input, profiles, outputFile) {
  const results = [];
  for (const { name: kind, args, entry } of profiles) {
    if (outputFile && existsSync(path.join(cwd, outputFile)))
      unlinkSync(path.join(cwd, outputFile));
    const result = spawnSync(process.execPath, [entry, ...args], { cwd, input, timeout: 30000 });
    assert.equal(result.status, 0, name + ' ' + kind + ' ' + String(result.error ?? ''));
    const channels = { stdout: result.stdout, stderr: result.stderr };
    if (outputFile) channels.svg = readFileSync(path.join(cwd, outputFile));
    for (const [channel, bytes] of Object.entries(channels)) {
      const file = path.join(run, name + '-' + kind + '.' + channel);
      writeFileSync(file, bytes);
      if (results.length) equalBytes(name + ' ' + kind + ' ' + channel, bytes, results[0][channel]);
    }
    records.push({
      name,
      profile: kind,
      args,
      exit: result.status,
      input: sha(input),
      channels: Object.fromEntries(
        Object.entries(channels).map(([k, v]) => [k, { bytes: v.length, sha256: sha(v) }]),
      ),
    });
    results.push(channels);
  }
  return results[0];
}
const basics = [old, a, b];
assert.ok(read('cli-1.txt').equals(readFileSync('test/fixtures/sessions/lab-6.txt')));
assert.ok(read('cli-1-groups.txt').equals(readFileSync('test/fixtures/sessions/lab-6-1-a.txt')));
writeFileSync(path.join(cwd, 'other.svg'), readFileSync('test/fixtures/svg/other.svg'));
const lab = compare('lab', read('cli-1.txt'), basics, 'demo.svg');
assert.match(lab.stdout.toString(), /\(5 elements\)[\s\S]+\(7 elements\)/);
assert.match(lab.stderr.toString(), /undo not allowed after io command[\s\S]+assigned id rect1/);
const groups = compare('groups', read('cli-1-groups.txt'), basics, 'flowchart.svg');
assert.match(groups.stdout.toString(), /\(8 elements\)/);
compare('compat', read('cli-compat.txt'), basics);
const baseHelp = compare('base-help', Buffer.from('help\n'), basics).stdout;
assert.equal(baseHelp.toString().trimEnd().split('\n').length, 19);
const boxes = compare('box', read('cli-box.txt'), box, 'flowchart-box.svg');
assert.equal(boxes.stderr.length, 0);
const stdout = boxes.stdout.toString();
for (const fragment of [
  'box#n1 created (g#n1 + rect#n1-rect + text#n1-label)',
  'box#n2 moved back by (0,-100)',
  'box#n2 fill propagated to n2-rect',
  'box#n2 label restored: "处理数据"',
  'g#n1 (box)',
  'g#n2 (box)',
  '(8 elements)',
])
  assert.ok(stdout.includes(fragment), fragment);
assert.equal(stdout.includes(' *'), false);
const xml = new DOMParser().parseFromString(boxes.svg.toString(), 'image/svg+xml');
assert.equal(xml.getElementsByTagName('*').length, 9);
for (const id of ['n1', 'n2'])
  assert.equal(xml.getElementById(id).getAttribute('data-kind'), 'box');
assert.equal(xml.getElementById('n2-rect').getAttribute('y'), '100');
assert.equal(xml.getElementById('n2-rect').getAttribute('fill'), '#f5a623');
assert.equal(xml.getElementById('n2-label').textContent, '处理数据');
const reread = Buffer.from('read flowchart-box.svg\ntree n2\n');
assert.match(compare('restored', reread, box).stdout.toString(), /g#n2 \(box\)/);
assert.doesNotMatch(compare('degraded', reread, [a, b]).stdout.toString(), /\(box\)/);
for (const file of ['flowchart-box.svg', 'flowchart.svg', 'demo.svg', 'other.svg'])
  unlinkSync(path.join(cwd, file));
for (const dir of ['.hidden', 'docs']) mkdirSync(path.join(cwd, dir));
for (const file of ['.env', 'sample.svg']) writeFileSync(path.join(cwd, file), 'fixture\n');
const before = readdirSync(cwd).sort();
const commandHelp = compare('demo-help', Buffer.from('help\n'), demo);
equalBytes(
  'help expected',
  commandHelp.stdout,
  Buffer.concat([
    baseHelp,
    Buffer.from('stats — Count leaves and containers\ndir — List the working directory\n'),
  ]),
);
const directory = compare('dir', read('cli-dir.txt'), demo);
equalBytes('directory independent expectation', directory.stdout, read('dir.stdout.txt'));
assert.equal(directory.stderr.length, 0);
const plugins = compare('plugins', read('cli-plugins.txt'), demo);
for (const channel of ['stdout', 'stderr'])
  equalBytes(
    channel + ' independent expectation',
    plugins[channel],
    read('plugins.' + channel + '.txt'),
  );
assert.deepEqual(readdirSync(cwd).sort(), before);
const receipt = { final, candidate: git(['rev-parse', 'HEAD']), cwd, raw: run, records };
writeFileSync(path.join(run, 'receipt.json'), JSON.stringify(receipt, null, 2));
writeFileSync(path.join(logs, 'latest.json'), JSON.stringify(receipt, null, 2));
console.log(`Verified ${records.length} compiled processes. Raw bytes: ${run}`);
