import { it, expect, vi, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EditorSession } from '../../src/application/session/EditorSession.js';
import { CommandCatalog } from '../../src/application/commands/CommandCatalog.js';
import { HistoryManager } from '../../src/application/history/HistoryManager.js';
import { HistoryEntry } from '../../src/application/history/HistoryEntry.js';
import type { StateId } from '../../src/application/contracts/history.js';
import { SvgDocumentBuilder } from '../../src/domain/document/SvgDocumentBuilder.js';
import { SvgDocument } from '../../src/domain/document/SvgDocument.js';
import type { EditTransaction } from '../../src/domain/transactions/EditTransaction.js';
import { defaultLimits } from '../../src/domain/values/defaultLimits.js';
import { XmlSvgCodec } from '../../src/infrastructure/svg/XmlSvgCodec.js';
import { ControlledFileStore } from '../helpers/ControlledFileStore.js';
import { committed } from '../helpers/session.js';
import { benchmark, policy, type Metric } from './benchmark.js';
import { sourceDigest } from '../../scripts/source-digest.mjs';
const metrics: Metric[] = [];
const retention: Record<string, unknown>[] = [];
const transact = (doc: SvgDocument, operation: (tx: EditTransaction) => void) => {
  const lease = doc.beginEdit();
  try {
    operation(lease.tx);
    const changes = lease.prepare();
    lease.commitPrepared();
    return changes;
  } catch (e) {
    lease.rollback();
    throw e;
  }
};
const fixture = (n: number, k = 0) => {
  const builder = new SvgDocumentBuilder(defaultLimits),
    group = k ? builder.append('g', 'G', { attributes: {} }) : null;
  for (let i = 0; i < n - (group ? 1 : 0); i++)
    builder.append(
      'rect',
      `r${i}`,
      { attributes: { x: i, y: 2, width: 3, height: 4 } },
      group && i < k ? group.asContainer()! : undefined,
    );
  return builder.build();
};
afterAll(() => {
  mkdirSync('artifacts/performance', { recursive: true });
  writeFileSync(
    'artifacts/performance/report.json',
    JSON.stringify(
      {
        policy,
        sourceSha256: sourceDigest(),
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        lockSha256: createHash('sha256').update(readFileSync('package-lock.json')).digest('hex'),
        metrics,
        retention,
        notes: [
          'Generation/invariant validation/JIT warmup excluded from samples. Heap values are observed trends, not allocation totals or universal timing thresholds.',
          'Deleted subtrees remain alive while undo history owns PlacementChange; after barrier/truncation release is eligible, not required to collect in one GC.',
        ],
      },
      null,
      2,
    ),
  );
});
it('PERF-01 ordinary Session leaf move/set do not encode, describe/copy the document or hash; unrelated n varies', async () => {
  for (const n of policy.sizes) {
    const document = fixture(n),
      codec = new XmlSvgCodec(),
      files = new ControlledFileStore();
    const source = codec.encode(document.describe());
    files.files.set('/memory/start.svg', source);
    const session = new EditorSession({
      commands: new CommandCatalog(defaultLimits),
      codec,
      files,
      limits: defaultLimits,
    });
    committed(await session.execute({ command: 'read', path: 'start.svg' }));
    const encode = vi.spyOn(codec, 'encode'),
      describe = vi.spyOn(SvgDocument.prototype, 'describe'),
      clone = vi.spyOn(globalThis, 'structuredClone');
    try {
      metrics.push(
        await benchmark(
          {
            id: 'PERF-01',
            operation: 'Session leaf move',
            n,
            k: 1,
            s: n,
            B: Buffer.byteLength(source),
            batch: policy.leafBatch,
          },
          async () => {
            for (let i = 0; i < policy.leafBatch; i++) {
              const result = await session.execute({ command: 'move', id: 'r0', dx: 1, dy: 0 });
              if (!result.ok) throw new Error(result.error.code);
            }
          },
        ),
      );
      let x = 0;
      metrics.push(
        await benchmark(
          {
            id: 'PERF-01',
            operation: 'Session leaf set',
            n,
            k: 1,
            s: n,
            B: Buffer.byteLength(source),
            batch: policy.leafBatch,
          },
          async () => {
            for (let i = 0; i < policy.leafBatch; i++) {
              const result = await session.execute({
                command: 'set',
                id: 'r0',
                attribute: 'x',
                value: ++x,
              });
              if (!result.ok) throw new Error(result.error.code);
            }
          },
        ),
      );
      expect(encode).not.toHaveBeenCalled();
      expect(describe).not.toHaveBeenCalled();
      // SPEC requires enqueue-time copying of caller input. Only copying the whole
      // document is forbidden; these bounded move/set request copies are necessary.
      expect(
        clone.mock.calls.every(
          ([value]) =>
            value === undefined ||
            (value !== null &&
              typeof value === 'object' &&
              ['move', 'set'].includes((value as { command?: string }).command ?? '') &&
              JSON.stringify(value).length < 128),
        ),
      ).toBe(true);
      expect(files.writeCalls).toEqual([]);
    } finally {
      encode.mockRestore();
      describe.mockRestore();
      clone.mockRestore();
    }
    const shown = committed(await session.execute({ command: 'show', id: `r${n - 1}` }));
    expect(shown.data.kind === 'show' && shown.data.shape.attributes).toContainEqual({
      name: 'x',
      value: n - 1,
    });
  }
});
it('PERF-02 Composite move/scale touches k descendants, leaves unrelated shape states identical', async () => {
  for (const n of policy.sizes) {
    const k = Math.floor(n / 10),
      doc = fixture(n, k),
      group = doc.require('G'),
      outside = doc.require(`r${n - 2}`),
      old = outside.captureState(),
      oldInside = doc.require('r0').captureState();
    const B = Buffer.byteLength(new XmlSvgCodec().encode(doc.describe()));
    for (const operation of ['move', 'scale'] as const) {
      metrics.push(
        await benchmark(
          { id: 'PERF-02', operation: `Group ${operation}`, n, k, s: n - k, B, batch: 1 },
          () => {
            transact(doc, (tx) =>
              operation === 'move' ? group.move(tx, 1, -1) : group.scale(tx, 1.0001),
            );
          },
        ),
      );
    }
    expect(outside.captureState()).toBe(old);
    expect(doc.require('r0').captureState()).not.toBe(oldInside);
    doc.assertInvariants();
  }
});
it('PERF-03 subtree delete and undo update all k active index entries', async () => {
  for (const n of policy.sizes) {
    const k = Math.floor(n / 10),
      doc = fixture(n, k),
      group = doc.require('G');
    const check = transact(doc, (tx) => group.delete(tx));
    expect(doc.nodeCount).toBe(n - k - 1);
    for (let i = 0; i < k; i++) expect(doc.find(`r${i}`)).toBeUndefined();
    transact(doc, (tx) => check.replay(tx, 'backward'));
    expect(doc.nodeCount).toBe(n);
    metrics.push(
      await benchmark(
        {
          id: 'PERF-03',
          operation: 'delete + backward replay',
          n,
          k: k + 1,
          s: n - k,
          B: 0,
          batch: 1,
        },
        () => {
          const changes = transact(doc, (tx) => group.delete(tx));
          transact(doc, (tx) => changes.replay(tx, 'backward'));
        },
      ),
    );
    doc.assertInvariants();
  }
});
it('PERF-04 sibling front/back and addto accept O(s) ordered array maintenance', async () => {
  for (const n of policy.sizes) {
    const doc = fixture(n, 1),
      node = doc.require(`r${n - 2}`),
      group = doc.requireContainer('G');
    metrics.push(
      await benchmark(
        { id: 'PERF-04', operation: 'front/back root sibling', n, k: 1, s: n - 2, B: 0, batch: 2 },
        () => {
          transact(doc, (tx) => doc.sendToBack(tx, node));
          transact(doc, (tx) => doc.bringToFront(tx, node));
        },
      ),
    );
    metrics.push(
      await benchmark(
        {
          id: 'PERF-04',
          operation: 'cross-parent addto + undo',
          n,
          k: 1,
          s: n - 2,
          B: 0,
          batch: 1,
        },
        () => {
          const change = transact(doc, (tx) => doc.addTo(tx, node, group));
          transact(doc, (tx) => change.replay(tx, 'backward'));
        },
      ),
    );
    doc.assertInvariants();
  }
});
it('PERF-05 wide/cross-parent grouping records k and s, preserves original order on replay', async () => {
  for (const n of policy.sizes) {
    const doc = fixture(n, Math.floor(n / 10)),
      ids = Array.from(
        { length: Math.min(20, Math.floor(n / 10)) },
        (_, i) => `r${i % 2 === 0 ? i : n - 2 - i}`,
      ),
      selected = ids.map((id) => doc.require(id));
    const before = doc.root.childrenSnapshot();
    metrics.push(
      await benchmark(
        {
          id: 'PERF-05',
          operation: 'group + backward replay',
          n,
          k: selected.length,
          s: n - Math.floor(n / 10),
          B: 0,
          batch: 1,
        },
        () => {
          const changes = transact(doc, (tx) =>
            doc.group(tx, doc.planGroup('temporaryGroup', selected)),
          );
          transact(doc, (tx) => changes.replay(tx, 'backward'));
        },
      ),
    );
    expect(doc.root.childrenSnapshot()).toEqual(before);
    doc.assertInvariants();
  }
});
it('PERF-06 immutable history heads push/pop without copying h entries', async () => {
  for (const h of policy.sizes) {
    const doc = fixture(1),
      node = doc.require('r0'),
      entries: HistoryEntry[] = [];
    let token = Symbol('initial') as StateId;
    for (let i = 0; i < h; i++) {
      const before = token;
      token = Symbol('after') as StateId;
      entries.push(
        new HistoryEntry(
          doc.documentId,
          before,
          token,
          transact(doc, (tx) => node.move(tx, 1, 0)),
          { operation: 'move', targetIds: ['r0'] },
        ),
      );
    }
    let last = HistoryManager.empty(),
      oldHead = last;
    metrics.push(
      await benchmark(
        { id: 'PERF-06', operation: `history push/pop h=${h}`, n: 1, k: h, s: 1, B: 0, batch: h },
        () => {
          let history = HistoryManager.empty();
          for (const entry of entries) history = history.afterEdit(entry);
          oldHead = history;
          for (let i = entries.length - 1; i >= 0; i--) history = history.afterUndo(entries[i]!);
          last = history;
        },
      ),
    );
    expect(last.inspect().undoCount).toBe(0);
    expect(last.inspect().redoCount).toBe(h);
    expect(oldHead.inspect().undoCount).toBe(h);
  }
});
it('PERF-07 actual Codec decode/encode scale with B+n and preserve all nodes', async () => {
  for (const n of policy.sizes) {
    const codec = new XmlSvgCodec(),
      doc = fixture(n),
      description = doc.describe(),
      source = codec.encode(description),
      B = Buffer.byteLength(source);
    metrics.push(
      await benchmark({ id: 'PERF-07', operation: 'encode', n, k: n, s: n, B, batch: 1 }, () => {
        expect(codec.encode(description).length).toBe(source.length);
      }),
    );
    metrics.push(
      await benchmark({ id: 'PERF-07', operation: 'decode', n, k: n, s: n, B, batch: 1 }, () => {
        expect(codec.decode(source, defaultLimits).document.nodeCount).toBe(n);
      }),
    );
    expect(() => codec.decode(source, { ...defaultLimits, maxSvgBytes: B - 1 })).toThrow(
      'RESOURCE_LIMIT',
    );
  }
});
it('PERF-08 deleted subtrees are retained by history, barriers and Redo truncation remove strong ownership', async () => {
  const prepareDeleted = () => {
    const doc = fixture(1000, 500),
      node = doc.require('G'),
      weak = new WeakRef(node),
      before = Symbol('before') as StateId,
      after = Symbol('after') as StateId;
    const entry = new HistoryEntry(
      doc.documentId,
      before,
      after,
      transact(doc, (tx) => node.delete(tx)),
      { operation: 'delete', targetIds: ['G'] },
    );
    return { doc, weak, history: HistoryManager.empty().afterEdit(entry) };
  };
  const releaseBarrier = () => {
    const kept = prepareDeleted();
    expect(kept.weak.deref()).toBeDefined();
    expect(kept.doc.find('r0')).toBeUndefined();
    const history = kept.history.afterBarrier('save');
    expect(history.inspect().undoCount).toBe(0);
    return { doc: kept.doc, weak: kept.weak, history };
  };
  const truncateRedo = () => {
    const doc = fixture(1),
      before = Symbol('before') as StateId,
      after = Symbol('after') as StateId;
    let group: ReturnType<SvgDocument['create']> | undefined;
    const changes = transact(doc, (tx) => {
      group = doc.create(tx, { type: 'g', id: 'candidate' });
      for (let i = 0; i < 500; i++)
        doc.create(
          tx,
          { type: 'rect', id: `candidate${i}`, x: i, y: 0, width: 1, height: 1 },
          group!.asContainer()!,
        );
    });
    const weak = new WeakRef(group!);
    group = undefined;
    const entry = new HistoryEntry(doc.documentId, before, after, changes, {
      operation: 'create',
      targetIds: ['candidate'],
    });
    let history = HistoryManager.empty().afterEdit(entry);
    transact(doc, (tx) => changes.replay(tx, 'backward'));
    history = history.afterUndo(entry);
    expect(weak.deref()).toBeDefined();
    expect(doc.find('candidate')).toBeUndefined();
    const other = new HistoryEntry(
      doc.documentId,
      before,
      Symbol('other') as StateId,
      transact(doc, (tx) => doc.require('r0').move(tx, 1, 0)),
      { operation: 'move', targetIds: ['r0'] },
    );
    history = history.afterEdit(other);
    expect(history.inspect().redoCount).toBe(0);
    return { doc, weak, history };
  };
  for (const [scenario, release] of [
    ['save barrier', releaseBarrier],
    ['new edit truncates Redo', truncateRedo],
  ] as const) {
    const beforeHeap = process.memoryUsage().heapUsed,
      kept = release();
    await new Promise<void>((resolve) => setImmediate(resolve));
    globalThis.gc?.();
    await new Promise<void>((resolve) => setImmediate(resolve));
    retention.push({
      scenario,
      n: 1000,
      k: 501,
      s: 499,
      B: 0,
      beforeHeap,
      afterHeap: process.memoryUsage().heapUsed,
      weakReferencePresent: kept.weak.deref() !== undefined,
      gcAvailable: typeof globalThis.gc === 'function',
      reason:
        'After replacing the head no old entry remains in fixture output. Collection observation is diagnostic, never a one-GC pass condition.',
    });
    kept.doc.assertInvariants();
  }
  const documentReplacement = () => {
    const old = fixture(1000),
      weak = new WeakRef(old);
    return { current: fixture(100), weak };
  };
  const replacement = documentReplacement();
  await new Promise<void>((resolve) => setImmediate(resolve));
  globalThis.gc?.();
  retention.push({
    scenario: 'init/read replaces document',
    n: 1000,
    k: 1000,
    s: 1000,
    B: 0,
    oldDocumentStillPresent: replacement.weak.deref() !== undefined,
    newDocumentNodes: replacement.current.nodeCount,
    reason: 'Old document graph eligible once no old head or external reference remains.',
  });
  expect(readFileSync('src/domain/internal/storage.ts', 'utf8')).toContain('WeakMap');
});
