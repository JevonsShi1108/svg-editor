import type { CommandRequest, Diagnostic } from '../../src/application/contracts/api.js';
import type { ShapeCreation } from '../../src/domain/values/contracts.js';
import type {
  FlatNode,
  ModelDocument,
  ModelState,
  ModelStep,
  Transition,
  PublicStatus,
  ComparableDocument,
  ComparableTree,
} from './types.js';
// Test-only snapshot model. No production behavior, transaction or Codec imports.
// Mutations below affect a deep-cloned candidate; production uses fine-grained logs instead.
export class ReferenceModel {
  constructor(
    readonly maxNodes = 30,
    readonly maxDepth = 5,
  ) {}
  initial(): ModelState {
    return {
      document: null,
      documentToken: 0,
      currentToken: null,
      savedToken: null,
      currentPath: null,
      revision: 0,
      barrier: null,
      undo: [],
      redo: [],
      nextUid: 1,
      nextToken: 1,
      files: {},
    };
  }
  emptyDocument(width = 800, height = 600): ModelDocument {
    return { width, height, attributes: {}, nodes: {}, root: [] };
  }
  status(s: ModelState): PublicStatus {
    return {
      state: s.document ? 'ready' : 'empty',
      revision: s.revision,
      currentPath: s.currentPath,
      dirty: s.document ? s.currentToken !== s.savedToken : false,
      history: { undoCount: s.undo.length, redoCount: s.redo.length, barrier: s.barrier },
    };
  }
  ids(d: ModelDocument): string[] {
    const visit = (uids: number[]): string[] =>
      uids.flatMap((uid) => {
        const n = d.nodes[uid]!;
        return [n.id, ...visit(n.children)];
      });
    return visit(d.root);
  }
  node(d: ModelDocument, id: string): FlatNode {
    const n = Object.values(d.nodes).find((n) => n.id === id);
    if (!n) throw new Error('SHAPE_NOT_FOUND');
    return n;
  }
  children(d: ModelDocument, parent: number | null): number[] {
    return parent === null ? d.root : d.nodes[parent]!.children;
  }
  describe(d: ModelDocument): ComparableDocument {
    const tree = (uid: number): ComparableTree => {
      const n = d.nodes[uid]!;
      return {
        type: n.type,
        id: n.id,
        attributes: structuredClone(n.attributes),
        ...(n.text === undefined ? {} : { text: n.text }),
        children: n.children.map(tree),
      };
    };
    return {
      size: { width: d.width, height: d.height },
      attributes: structuredClone(d.attributes),
      children: d.root.map(tree),
    };
  }
  step(original: ModelState, step: ModelStep): Transition {
    const s = structuredClone(original),
      r = step.request;
    const mode = step.options?.mode ?? 'commit';
    const success = (
      contentChanged = false,
      sessionChanged = false,
      warnings: Diagnostic[] = [],
    ): Transition => ({
      state: s,
      result: { ok: true, mode: 'commit', contentChanged, sessionChanged, warnings },
    });
    const barrier = (reason: ModelState['barrier']) => {
      s.undo = [];
      s.redo = [];
      s.barrier = reason;
      s.revision++;
    };
    try {
      const isEdit = [
        'create',
        'delete',
        'move',
        'scale',
        'set',
        'group',
        'ungroup',
        'addto',
        'front',
        'back',
      ].includes(r.command);
      if (mode !== 'commit' && !isEdit) throw new Error('UNSUPPORTED_MODE');
      if (r.command === 'scale' && (!Number.isFinite(r.factor) || r.factor <= 0))
        throw new Error('INVALID_SCALE');
      if (r.command === 'help') return success();
      if (r.command === 'init') {
        const size = r.size ?? { width: 800, height: 600 };
        if (
          size.width <= 0 ||
          size.height <= 0 ||
          !Number.isFinite(size.width) ||
          !Number.isFinite(size.height)
        )
          throw new Error('INVALID_VALUE');
        s.document = this.emptyDocument(size.width, size.height);
        s.documentToken++;
        s.currentToken = s.nextToken++;
        s.savedToken = null;
        s.currentPath = null;
        barrier('init');
        return success(true, true);
      }
      if (r.command === 'read') {
        const path = this.resolve(r.path),
          file = s.files[path];
        if (!file) throw new Error('FILE_IO_ERROR');
        if (!file.document) throw new Error('UNSUPPORTED_SVG');
        const d = structuredClone(file.document),
          mapping = new Map<number, number>();
        for (const old of Object.keys(d.nodes).map(Number)) mapping.set(old, s.nextUid++);
        d.nodes = Object.fromEntries(
          Object.values(d.nodes).map((n) => {
            const uid = mapping.get(n.uid)!;
            return [
              uid,
              {
                ...n,
                uid,
                parent: n.parent === null ? null : mapping.get(n.parent)!,
                children: n.children.map((child) => mapping.get(child)!),
              },
            ];
          }),
        );
        d.root = d.root.map((uid) => mapping.get(uid)!);
        this.validate(d);
        s.document = d;
        s.documentToken++;
        s.currentToken = s.nextToken++;
        s.savedToken = file.repair ? null : s.currentToken;
        s.currentPath = path;
        barrier('read');
        return success(
          true,
          true,
          file.repair ? [{ code: 'ASSIGNED_ID', parameters: { type: 'rect', id: 'rect1' } }] : [],
        );
      }
      if (!s.document) throw new Error('NO_DOCUMENT');
      const d = s.document;
      if (r.command === 'tree' || r.command === 'show' || (r.command === 'canvas' && !r.size)) {
        if (r.command === 'show' || (r.command === 'tree' && r.id !== undefined))
          this.node(d, r.id!);
        return success();
      }
      if (r.command === 'save') {
        const path = r.path === undefined ? s.currentPath : this.resolve(r.path);
        if (path === null) throw new Error('NO_SAVE_PATH');
        if (step.outcome === 'not-committed')
          return {
            state: original,
            result: { ok: false, error: 'FILE_IO_ERROR', effect: 'unchanged' },
          };
        if (step.outcome === 'indeterminate') {
          if (step.physical) s.files[path] = { document: structuredClone(d), repair: false };
          return {
            state: s,
            result: { ok: false, error: 'SAVE_OUTCOME_UNKNOWN', effect: 'external-unknown' },
          };
        }
        s.files[path] = { document: structuredClone(d), repair: false };
        s.currentPath = path;
        s.savedToken = s.currentToken;
        barrier('save');
        return success(false, true);
      }
      if (r.command === 'canvas') {
        const size = r.size!;
        if (
          size.width <= 0 ||
          size.height <= 0 ||
          !Number.isFinite(size.width) ||
          !Number.isFinite(size.height)
        )
          throw new Error('INVALID_VALUE');
        if (size.width === d.width && size.height === d.height) return success();
        d.width = size.width;
        d.height = size.height;
        s.currentToken = s.nextToken++;
        barrier('canvas');
        return success(true, true);
      }
      if (r.command === 'undo' || r.command === 'redo') {
        if (s.barrier) throw new Error('HISTORY_BLOCKED');
        const from = r.command === 'undo' ? s.undo : s.redo,
          to = r.command === 'undo' ? s.redo : s.undo;
        const entry = from.pop();
        if (!entry) throw new Error(r.command === 'undo' ? 'NOTHING_TO_UNDO' : 'NOTHING_TO_REDO');
        to.push(entry);
        s.document = structuredClone(r.command === 'undo' ? entry.before : entry.after);
        s.currentToken = r.command === 'undo' ? entry.beforeToken : entry.afterToken;
        s.revision++;
        return success(true, true);
      }
      const before = structuredClone(d),
        beforeToken = s.currentToken!;
      this.edit(s, d, r);
      this.validate(d);
      const changed = JSON.stringify(d) !== JSON.stringify(before);
      if (mode === 'dry-run')
        return {
          state: original,
          result: { ok: true, mode: 'dry-run', wouldChange: changed, warnings: [] },
        };
      const sessionChanged = changed || s.barrier !== null;
      if (changed) {
        s.currentToken = s.nextToken++;
        s.undo.push({ before, after: structuredClone(d), beforeToken, afterToken: s.currentToken });
        s.redo = [];
      }
      s.barrier = null;
      if (sessionChanged) s.revision++;
      return success(changed, sessionChanged);
    } catch (error) {
      return {
        state: original,
        result: { ok: false, error: (error as Error).message, effect: 'unchanged' },
      };
    }
  }
  resolve(path: string): string {
    if (!path || path.includes('\0')) throw new Error('FILE_IO_ERROR');
    return path.startsWith('/') ? path : `/memory/${path}`;
  }
  create(
    s: ModelState,
    d: ModelDocument,
    shape: ShapeCreation,
    parent: number | null = null,
  ): FlatNode {
    if (Object.values(d.nodes).some((n) => n.id === shape.id)) throw new Error('DUPLICATE_ID');
    const { type, id, ...fields } = shape;
    const attributes: Record<string, string | number> = {};
    let text: string | undefined;
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'text') text = String(value);
      else
        attributes[key] = typeof value === 'string' ? value.toLowerCase() : value === 0 ? 0 : value;
    }
    const uid = s.nextUid++,
      node: FlatNode = {
        uid,
        id,
        type,
        attributes,
        ...(text === undefined ? {} : { text }),
        parent,
        children: [],
      };
    d.nodes[uid] = node;
    this.children(d, parent).push(uid);
    return node;
  }
  private edit(s: ModelState, d: ModelDocument, r: CommandRequest): void {
    if (r.command === 'create') {
      let parent: number | null = null;
      if (r.parentId !== undefined) {
        const p = Object.values(d.nodes).find((n) => n.id === r.parentId);
        if (!p) throw new Error('CONTAINER_NOT_FOUND');
        if (p.type !== 'g') throw new Error('NOT_A_CONTAINER');
        parent = p.uid;
      }
      this.create(s, d, r.shape, parent);
      return;
    }
    if (r.command === 'group') {
      this.group(s, d, r.newId, r.ids);
      return;
    }
    if (!('id' in r) || r.id === undefined) throw new Error('MODEL_UNHANDLED');
    const n = this.node(d, r.id);
    if (r.command === 'move' || r.command === 'scale') {
      const axes: Record<string, readonly (readonly [string, string])[]> = {
        rect: [['x', 'y']],
        circle: [['cx', 'cy']],
        ellipse: [['cx', 'cy']],
        line: [
          ['x1', 'y1'],
          ['x2', 'y2'],
        ],
        text: [['x', 'y']],
        g: [],
      };
      const visit = (node: FlatNode) => {
        if (r.command === 'move')
          for (const [x, y] of axes[node.type]!)
            for (const [field, delta] of [
              [x, r.dx],
              [y, r.dy],
            ] as const) {
              const old = Number(node.attributes[field] ?? 0),
                next = old + delta;
              if (next !== old) node.attributes[field] = next === 0 ? 0 : next;
            }
        else if (r.factor !== 1)
          for (const [field, old] of Object.entries(node.attributes))
            if (typeof old === 'number' && !['stroke-width', 'font-size'].includes(field)) {
              const next = old * r.factor;
              if (next !== old) node.attributes[field] = next === 0 ? 0 : next;
            }
        for (const child of node.children) visit(d.nodes[child]!);
      };
      visit(n);
      return;
    }
    if (r.command === 'set') {
      const geometry: Record<string, readonly string[]> = {
        rect: ['x', 'y', 'width', 'height'],
        circle: ['cx', 'cy', 'r'],
        ellipse: ['cx', 'cy', 'rx', 'ry'],
        line: ['x1', 'y1', 'x2', 'y2'],
        text: ['x', 'y', 'text'],
        g: [],
      };
      if (![...geometry[n.type]!, 'fill', 'stroke', 'stroke-width'].includes(r.attribute))
        throw new Error('UNKNOWN_ATTRIBUTE');
      if (r.attribute === 'text') {
        n.text = String(r.value);
        return;
      }
      if (r.attribute === 'fill' || r.attribute === 'stroke')
        n.attributes[r.attribute] = String(r.value).trim().toLowerCase();
      else {
        const value = Number(r.value);
        if (
          !Number.isFinite(value) ||
          (['width', 'height', 'r', 'rx', 'ry', 'stroke-width'].includes(r.attribute) && value < 0)
        )
          throw new Error('INVALID_VALUE');
        n.attributes[r.attribute] = value === 0 ? 0 : value;
      }
      return;
    }
    const siblings = this.children(d, n.parent),
      index = siblings.indexOf(n.uid);
    if (r.command === 'delete') {
      siblings.splice(index, 1);
      const remove = (uid: number) => {
        for (const child of d.nodes[uid]!.children) remove(child);
        delete d.nodes[uid];
      };
      remove(n.uid);
      return;
    }
    if (r.command === 'ungroup') {
      if (n.type !== 'g') throw new Error('NOT_A_CONTAINER');
      if (n.parent === null) throw new Error('TOP_LEVEL_UNGROUP');
      siblings.splice(index, 1, ...n.children);
      for (const uid of n.children) d.nodes[uid]!.parent = n.parent;
      delete d.nodes[n.uid];
      return;
    }
    if (r.command === 'front' || r.command === 'back') {
      siblings.splice(index, 1);
      if (r.command === 'front') siblings.push(n.uid);
      else siblings.unshift(n.uid);
      return;
    }
    if (r.command === 'addto') {
      const p = Object.values(d.nodes).find((n) => n.id === r.containerId);
      if (!p) throw new Error('CONTAINER_NOT_FOUND');
      if (p.type !== 'g') throw new Error('NOT_A_CONTAINER');
      for (
        let a: FlatNode | undefined = p;
        a;
        a = a.parent === null ? undefined : d.nodes[a.parent]
      )
        if (a.uid === n.uid) throw new Error('INVALID_HIERARCHY');
      siblings.splice(index, 1);
      p.children.push(n.uid);
      n.parent = p.uid;
      return;
    }
    throw new Error('MODEL_UNHANDLED');
  }
  private group(s: ModelState, d: ModelDocument, id: string, ids: readonly string[]): void {
    if (Object.values(d.nodes).some((n) => n.id === id)) throw new Error('DUPLICATE_ID');
    if (ids.length < 2) throw new Error('INVALID_GROUP_SIZE');
    if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_TARGET');
    const selected = ids.map((id) => this.node(d, id));
    const paths = new Map<number, number[]>();
    const visit = (uids: number[], prefix: number[]) =>
      uids.forEach((uid, i) => {
        const path = [...prefix, i];
        paths.set(uid, path);
        visit(d.nodes[uid]!.children, path);
      });
    visit(d.root, []);
    const isPrefix = (a: number[], b: number[]) =>
      a.length < b.length && a.every((part, i) => part === b[i]);
    for (const a of selected)
      for (const b of selected)
        if (isPrefix(paths.get(a.uid)!, paths.get(b.uid)!)) throw new Error('GROUP_ANCESTOR');
    selected.sort((a, b) => {
      const x = paths.get(a.uid)!,
        y = paths.get(b.uid)!;
      for (let i = 0; i < Math.min(x.length, y.length); i++)
        if (x[i] !== y[i]) return x[i]! - y[i]!;
      return x.length - y.length;
    });
    const first = paths.get(selected[0]!.uid)!.slice(0, -1);
    let common = first.length;
    for (const node of selected) {
      const path = paths.get(node.uid)!.slice(0, -1);
      common = Math.min(common, path.length);
      while (common > 0 && !first.slice(0, common).every((v, i) => v === path[i])) common--;
    }
    let parent: number | null = null;
    for (const index of first.slice(0, common)) parent = this.children(d, parent)[index]!;
    const oldChildren = [...this.children(d, parent)],
      j = Math.max(...selected.map((n) => paths.get(n.uid)![common]!));
    const chosen = new Set(selected.map((n) => n.uid));
    // Rebuild all affected child arrays once, from the original tree. No placement replay.
    const remaining = (uids: number[]) => uids.filter((uid) => !chosen.has(uid));
    d.root = remaining(d.root);
    for (const node of Object.values(d.nodes)) node.children = remaining(node.children);
    const insertion = oldChildren.slice(0, j + 1).filter((uid) => !chosen.has(uid)).length;
    const uid = s.nextUid++;
    d.nodes[uid] = {
      uid,
      id,
      type: 'g',
      attributes: {},
      parent,
      children: selected.map((n) => n.uid),
    };
    for (const node of selected) node.parent = uid;
    this.children(d, parent).splice(insertion, 0, uid);
  }
  validate(d: ModelDocument): void {
    const seen = new Set<number>(),
      ids = new Set<string>();
    const visit = (uids: number[], parent: number | null, depth: number) => {
      for (const uid of uids) {
        const n = d.nodes[uid];
        if (
          !n ||
          seen.has(uid) ||
          ids.has(n.id) ||
          n.parent !== parent ||
          (n.type !== 'g' && n.children.length)
        )
          throw new Error('MODEL_INVARIANT');
        if (depth > this.maxDepth) throw new Error('RESOURCE_LIMIT');
        seen.add(uid);
        ids.add(n.id);
        for (const v of Object.values(n.attributes))
          if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('INVALID_VALUE');
        visit(n.children, uid, depth + 1);
      }
    };
    visit(d.root, null, 1);
    if (seen.size !== Object.keys(d.nodes).length) throw new Error('MODEL_GHOST');
    if (seen.size > this.maxNodes) throw new Error('RESOURCE_LIMIT');
  }
}
