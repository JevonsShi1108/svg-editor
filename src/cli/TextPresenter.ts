import type { ExecutionResult, Diagnostic, ResultData } from '../application/contracts/api.js';
import type { ShapeDescription, TreeNodeDescription } from '../domain/values/contracts.js';
export class TextPresenter {
  safe(value: unknown): string {
    return [...String(value)]
      .map((char) =>
        char.charCodeAt(0) >= 32 && (char.charCodeAt(0) < 127 || char.charCodeAt(0) > 159)
          ? char
          : char === '\n'
            ? '\\n'
            : char === '\r'
              ? '\\r'
              : char === '\t'
                ? '\\t'
                : `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
      )
      .join('');
  }
  diagnostic(diagnostic: Diagnostic): string {
    const p = diagnostic.parameters;
    const value = (name: string) => this.safe(p[name]);
    const text: Readonly<Record<string, () => string>> = {
      DUPLICATE_ID: () => `id already exists: ${value('id')}`,
      SHAPE_NOT_FOUND: () => `no such shape: ${value('id')}`,
      CONTAINER_NOT_FOUND: () => `no such container: ${value('id')}`,
      NOT_A_CONTAINER: () => `not a container: ${value('id')}`,
      UNKNOWN_SHAPE_TYPE: () => `unknown shape type: ${value('type')} (is the plugin loaded?)`,
      GROUP_ANCESTOR: () => `cannot group a container into its own descendant: ${value('id')}`,
      TOP_LEVEL_UNGROUP: () => `cannot ungroup top-level container: ${value('id')}`,
      INVALID_SCALE: () => `scale factor must be positive`,
      NO_DOCUMENT: () => `no document. use 'init' or 'read' first`,
      UNKNOWN_ATTRIBUTE: () => `unknown attribute: ${value('attribute')}`,
      HISTORY_BLOCKED: () => `${value('direction')} not allowed after io command`,
      FILE_IO_ERROR: () =>
        `cannot ${p.operation === 'read' ? 'read' : 'write'} file: ${value('path')}`,
      SAVE_OUTCOME_UNKNOWN: () => `save outcome unknown: ${value('path')}`,
      ASSIGNED_ID: () => `assigned id ${value('id')} to unnamed <${value('type')}>`,
    };
    const message =
      text[diagnostic.code]?.() ?? this.safe(diagnostic.code.toLowerCase().replaceAll('_', ' '));
    return `${diagnostic.code === 'ASSIGNED_ID' ? 'warning' : 'error'}: ${message}\n`;
  }
  render(result: ExecutionResult): { readonly stdout: string; readonly stderr: string } {
    if (!result.ok) return { stdout: '', stderr: this.diagnostic(result.error) };
    if (result.mode === 'dry-run')
      return {
        stdout: `would change: ${result.wouldChange}\n`,
        stderr: result.warnings.map((w) => this.diagnostic(w)).join(''),
      };
    return {
      stdout: this.data(result.data),
      stderr: result.warnings.map((w) => this.diagnostic(w)).join(''),
    };
  }
  private shape(shape: ShapeDescription, annotation = ''): string {
    return `${this.safe(shape.type)}#${this.safe(shape.id)}${annotation ? ` ${annotation}` : ''}${shape.displayFields.length ? '  ' + shape.displayFields.map((f) => `${this.safe(f.label)}=${this.safe(f.value)}`).join(' ') : ''}${shape.text === undefined ? '' : ` ${this.safe(JSON.stringify(shape.text))}`}`;
  }
  private tree(node: TreeNodeDescription, prefix = '', branch = ''): string {
    let output = `${prefix}${branch}${this.shape(node.shape)}\n`;
    const childPrefix = prefix + (branch ? (branch === '└── ' ? '    ' : '│   ') : '');
    for (const [index, child] of node.children.entries())
      output += this.tree(child, childPrefix, index === node.children.length - 1 ? '└── ' : '├── ');
    return output;
  }
  private data(data: ResultData): string {
    switch (data.kind) {
      case 'help':
        return data.commands.map((c) => `${c.syntax} — ${c.description}\n`).join('');
      case 'tree': {
        if (data.node) return this.tree(data.node);
        const doc = data.document!;
        let out = `svg (${doc.size.width}x${doc.size.height})\n`;
        for (const [i, node] of doc.children.entries())
          out += this.tree(node, '', i === doc.children.length - 1 ? '└── ' : '├── ');
        return out;
      }
      case 'show':
        return `${this.safe(data.shape.type)}#${this.safe(data.shape.id)}  parent=${data.parent.kind === 'root' ? 'svg' : `g#${this.safe(data.parent.id)}`}\n${data.shape.attributes.map((a) => `  ${this.safe(a.name)}=${this.safe(a.value)}\n`).join('')}${data.shape.text === undefined ? '' : `  text=${this.safe(JSON.stringify(data.shape.text))}\n`}`;
      case 'edit':
        return data.facts.shapes
          .map((shape) => {
            const details = Object.entries(data.facts.details ?? {})
              .map(([key, value]) => `${this.safe(key)}=${this.safe(JSON.stringify(value))}`)
              .join(' ');
            return `${this.shape(shape, `${this.safe(data.facts.action)}${details ? ` (${details})` : ''}`)}\n`;
          })
          .join('');
      case 'history':
        return `${data.direction} ${data.description.operation} ${data.description.targetIds.map((id) => this.safe(id)).join(', ')}\n${data.shapes.map((shape) => `  ${this.shape(shape)}\n`).join('')}`;
      case 'canvas':
        return `canvas ${data.size.width}x${data.size.height}\n`;
      case 'document':
        return data.operation === 'init'
          ? `canvas ${data.size.width}x${data.size.height} created\n`
          : `${data.operation === 'save' ? 'saved to' : 'read'} ${this.safe(data.path)} (${data.nodeCount} elements)\n`;
    }
  }
}
