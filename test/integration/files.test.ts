import { afterEach, expect, it, describe, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { NodeFileStore } from '../../src/infrastructure/files/NodeFileStore.js';
import { TempDirectory } from '../helpers/TempDirectory.js';
import { FaultFileSystem } from '../helpers/FaultFileSystem.js';
import { Deferred } from '../helpers/Deferred.js';
const owned: TempDirectory[] = [];
const fixture = async () => {
  const temp = await TempDirectory.create();
  owned.push(temp);
  return { temp, store: new NodeFileStore(temp.path) };
};
afterEach(async () => {
  for (const temp of owned.splice(0)) await temp.close();
});
describe('M11 real NodeFileStore on actual platform, no production stubs', () => {
  it('FS-01/02 strict UTF-8 split multibyte, BOM retained and malformed/truncated bytes reject', async () => {
    const { temp, store } = await fixture();
    const text = '\uFEFF' + 'a'.repeat(NodeFileStore.readChunkBytes - 4) + '🙂中文';
    const file = store.resolve('中文 space.svg');
    await fs.writeFile(file, text, 'utf8');
    expect(await store.readUtf8(file, Buffer.byteLength(text))).toBe(text);
    for (const [i, bytes] of [
      Buffer.from([0xff]),
      Buffer.from([0xc3]),
      Buffer.from([0xc0, 0xaf]),
      Buffer.from([0xf0, 0x9f]),
    ].entries()) {
      const target = store.resolve(`bad${i}.svg`);
      await fs.writeFile(target, bytes);
      await expect(store.readUtf8(target, 100)).rejects.toThrow('FILE_IO_ERROR');
    }
    expect(path.dirname(file)).toBe(temp.path);
  });
  it('FS-03/04 missing/directory/first create/overwrite preserve old targets and errors allow recovery', async () => {
    const { temp, store } = await fixture();
    const target = store.resolve('a.svg');
    await expect(store.readUtf8(target, 100)).rejects.toThrow('FILE_IO_ERROR');
    expect((await store.replaceUtf8(target, 'NEW 中文🙂')).status).toBe('committed');
    expect(await fs.readFile(target, 'utf8')).toBe('NEW 中文🙂');
    expect((await store.replaceUtf8(target, 'SECOND')).status).toBe('committed');
    expect(await fs.readFile(target, 'utf8')).toBe('SECOND');
    await expect(store.readUtf8(store.resolve('.'), 100)).rejects.toThrow();
    expect((await store.replaceUtf8(store.resolve('.'), 'BAD')).status).toBe('not-committed');
    expect((await store.replaceUtf8(store.resolve('missing-parent/a.svg'), 'BAD')).status).toBe(
      'not-committed',
    );
    expect(await fs.readdir(temp.path)).toEqual(['a.svg']);
    expect((await store.replaceUtf8(target, 'RECOVER')).status).toBe('committed');
  });
  it('FS-05 eight bounded exclusive temp collisions preserve pre-existing collision file', async () => {
    const { temp } = await fixture();
    const port = new FaultFileSystem();
    const store = new NodeFileStore(temp.path, port, () => 'fixed');
    const target = store.resolve('a.svg');
    const collision = path.join(temp.path, '.a.svg.svg-editor-fixed.tmp');
    await fs.writeFile(target, 'OLD');
    await fs.writeFile(collision, 'NOT OURS');
    const result = await store.replaceUtf8(target, 'NEW');
    expect(result.status).toBe('not-committed');
    expect(await fs.readFile(target, 'utf8')).toBe('OLD');
    expect(await fs.readFile(collision, 'utf8')).toBe('NOT OURS');
    expect(port.events.filter((e) => e.startsWith('open:wx:'))).toHaveLength(8);
    await fs.unlink(collision);
    expect((await store.replaceUtf8(target, 'NEW')).status).toBe('committed');
    expect(await fs.readFile(target, 'utf8')).toBe('NEW');
  });
  it('FS-06 replacement cannot precede complete write and close; temporary resides next to target', async () => {
    const { temp } = await fixture();
    const port = new FaultFileSystem();
    const store = new NodeFileStore(temp.path, port);
    const target = store.resolve('a.svg');
    await fs.writeFile(target, 'OLD');
    port.writeGate = new Deferred<void>();
    port.closeGate = new Deferred<void>();
    const result = store.replaceUtf8(target, 'NEW');
    await port.writeStarted.promise;
    expect(port.events).not.toContain('rename');
    expect(await fs.readFile(target, 'utf8')).toBe('OLD');
    const temporary = (await fs.readdir(temp.path)).find((name) => name.endsWith('.tmp'));
    expect(temporary).toBeDefined();
    port.writeGate.resolve(undefined);
    await port.closeStarted.promise;
    expect(port.events).toContain('write:done');
    expect(port.events).not.toContain('rename');
    port.closeGate.resolve(undefined);
    expect((await result).status).toBe('committed');
    expect(port.events.indexOf('rename')).toBeGreaterThan(port.events.indexOf('close:done'));
    expect(await fs.readdir(temp.path)).toEqual(['a.svg']);
  });
  for (const point of ['create', 'write', 'close', 'replace-known'] as const)
    it(`FS-07 confirms no target commit on ${point} failure, cleans only owned temp and permits next save`, async () => {
      const { temp } = await fixture();
      const port = new FaultFileSystem();
      port.failCreate = point === 'create';
      port.failWrite = point === 'write';
      port.failClose = point === 'close';
      port.renameError = point === 'replace-known' ? 'EACCES' : null;
      const store = new NodeFileStore(temp.path, port);
      const target = store.resolve('a.svg');
      await fs.writeFile(target, 'OLD');
      const result = await store.replaceUtf8(target, 'NEW DATA');
      expect(result.status).toBe('not-committed');
      if (result.status !== 'committed')
        expect(result.error.stage).toBe(point === 'replace-known' ? 'replace' : point);
      expect(await fs.readFile(target, 'utf8')).toBe('OLD');
      expect(await fs.readdir(temp.path)).toEqual(['a.svg']);
      port.failCreate = false;
      port.failWrite = false;
      port.failClose = false;
      port.renameError = null;
      expect((await store.replaceUtf8(target, 'RECOVER')).status).toBe('committed');
    });
  it('FS-08 cleanup failure preserves primary write stage and reports owned residue', async () => {
    const { temp } = await fixture();
    const port = new FaultFileSystem();
    port.failWrite = true;
    port.failUnlink = true;
    const store = new NodeFileStore(temp.path, port);
    const target = store.resolve('a.svg');
    await fs.writeFile(target, 'OLD');
    const result = await store.replaceUtf8(target, 'NEW');
    expect(result.status).toBe('not-committed');
    if (result.status === 'committed') throw new Error('wrong outcome');
    expect(result.error.stage).toBe('write');
    expect(result.error.cleanupError).toBeDefined();
    expect(result.error.temporaryPath).toBeDefined();
    expect(path.dirname(result.error.temporaryPath!)).toBe(temp.path);
    expect(await fs.readFile(target, 'utf8')).toBe('OLD');
  });
  it('FS-09/LIM-01 real accumulated bytes control admission, not stat.size; L−1/L/L+1', async () => {
    const { temp } = await fixture();
    const port = new FaultFileSystem();
    const store = new NodeFileStore(temp.path, port);
    const target = store.resolve('a.svg');
    const text = '中文🙂';
    const n = Buffer.byteLength(text);
    await fs.writeFile(target, text, 'utf8');
    for (const max of [n, n + 1]) expect(await store.readUtf8(target, max)).toBe(text);
    await expect(store.readUtf8(target, n - 1)).rejects.toMatchObject({
      diagnostic: { code: 'RESOURCE_LIMIT' },
    });
  });
  it('FS-10 fixed cwd, literal tilde/environment variables and invalid paths', async () => {
    const { temp, store } = await fixture();
    expect(store.resolve('a.svg')).toBe(path.join(temp.path, 'a.svg'));
    expect(store.resolve('~')).toBe(path.join(temp.path, '~'));
    expect(store.resolve('$VAR')).toBe(path.join(temp.path, '$VAR'));
    expect(store.resolve('%VAR%')).toBe(path.join(temp.path, '%VAR%'));
    expect(() => store.resolve('')).toThrow();
    expect(() => store.resolve('\0')).toThrow();
  });
  it('FS-10 actual file symlink and dangling link refusal (requires OS link capability)', async () => {
    const { store } = await fixture();
    const target = store.resolve('target.svg');
    await fs.writeFile(target, 'OLD');
    for (const dangling of [false, true]) {
      const link = store.resolve(dangling ? 'dangling.svg' : 'link.svg');
      await fs.symlink(dangling ? store.resolve('absent.svg') : target, link, 'file');
      await expect(store.readUtf8(link, 100)).rejects.toThrow('FILE_IO_ERROR');
      expect((await store.replaceUtf8(link, 'BAD')).status).toBe('not-committed');
      expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);
    }
    expect(await fs.readFile(target, 'utf8')).toBe('OLD');
  });
  it('FS-10 adapter refuses symbolic file type before opening or replacing, with injected filesystem metadata', async () => {
    const { temp } = await fixture();
    const port = new FaultFileSystem();
    vi.spyOn(port, 'lstat').mockResolvedValue({ isFile: () => false, isSymbolicLink: () => true });
    const store = new NodeFileStore(temp.path, port);
    await expect(store.readUtf8(store.resolve('link.svg'), 100)).rejects.toThrow('FILE_IO_ERROR');
    expect((await store.replaceUtf8(store.resolve('link.svg'), 'NEW')).status).toBe(
      'not-committed',
    );
    expect(port.events.some((e) => e.startsWith('open:'))).toBe(false);
  });
  for (const physical of [false, true])
    it(`FS-11 EIO cannot prove target unchanged, physical replacement=${physical}`, async () => {
      const { temp } = await fixture();
      const port = new FaultFileSystem();
      port.renameError = 'EIO';
      port.renameActuallyMoves = physical;
      const store = new NodeFileStore(temp.path, port);
      const target = store.resolve('a.svg');
      await fs.writeFile(target, 'OLD');
      const result = await store.replaceUtf8(target, 'NEW');
      expect(result.status).toBe('indeterminate');
      if (result.status !== 'committed') expect(result.error.stage).toBe('replace');
      expect(port.events.filter((e) => e === 'rename')).toHaveLength(1);
      expect(await fs.readdir(temp.path)).toEqual(['a.svg']);
    });
  it('temp token is confined to a single filename and never permits directory traversal', async () => {
    const { temp } = await fixture();
    const store = new NodeFileStore(temp.path, undefined, () => '../../escape');
    const result = await store.replaceUtf8(store.resolve('a.svg'), 'NEW');
    expect(result.status).toBe('not-committed');
    expect(await fs.readdir(temp.path)).toEqual([]);
  });
});
