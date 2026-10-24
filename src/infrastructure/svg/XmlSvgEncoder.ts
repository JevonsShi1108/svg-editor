import type {
  AttributeDescription,
  DocumentDescription,
  TreeNodeDescription,
} from '../../domain/values/contracts.js';
import { ShapeFactory } from '../../domain/shapes/ShapeFactory.js';
import { CanvasRoot } from '../../domain/document/CanvasRoot.js';
import { XmlCharacters } from '../../domain/values/XmlCharacters.js';
import { EditorError } from '../../application/errors/EditorError.js';
export class XmlSvgEncoder {
  readonly #factory = new ShapeFactory();
  encode(description: DocumentDescription): string {
    const { width, height } = description.size;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      throw new EditorError('INVALID_VALUE', { field: 'canvas' });
    const rootAllowed = CanvasRoot.schema.allowedAttributes.filter(
      (name) => name !== 'width' && name !== 'height',
    );
    const root = this.attributes(description.attributes, rootAllowed);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${root}>\n${description.children.map((node) => this.node(node, 1)).join('')}</svg>\n`;
  }
  private node(node: TreeNodeDescription, depth: number): string {
    const shape = node.shape;
    const schema = this.#factory.definition(shape.type).schema;
    const prefix = '  '.repeat(depth);
    const open = `${prefix}<${shape.type} id="${this.escape(shape.id, true)}"${this.attributes(shape.attributes, schema.allowedAttributes)}`;
    if (schema.contentModel === 'text') {
      if (node.children.length) throw new EditorError('UNSUPPORTED_SVG');
      return `${open}>${this.escape(shape.text ?? '', false)}</${shape.type}>\n`;
    }
    if (shape.text !== undefined || (schema.contentModel !== 'container' && node.children.length))
      throw new EditorError('UNSUPPORTED_SVG');
    if (!node.children.length) return `${open}/>\n`;
    return `${open}>\n${node.children.map((child) => this.node(child, depth + 1)).join('')}${prefix}</${shape.type}>\n`;
  }
  private attributes(
    attributes: readonly AttributeDescription[],
    allowed: readonly string[],
  ): string {
    const seen = new Set<string>();
    return [...attributes]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map(({ name, value }) => {
        if (seen.has(name) || !allowed.includes(name))
          throw new EditorError('UNSUPPORTED_SVG', { attribute: name });
        seen.add(name);
        if (typeof value === 'number' && !Number.isFinite(value))
          throw new EditorError('INVALID_VALUE', { field: name });
        return ` ${name}="${this.escape(String(value), true)}"`;
      })
      .join('');
  }
  private escape(value: string, attribute: boolean): string {
    XmlCharacters.validate(value);
    return value.replace(/[&<>"\r\n\t]/g, (char) => {
      if (char === '&') return '&amp;';
      if (char === '<') return '&lt;';
      if (char === '>') return '&gt;';
      if (char === '\r') return '&#xD;';
      if (attribute) {
        if (char === '"') return '&quot;';
        if (char === '\n') return '&#xA;';
        if (char === '\t') return '&#x9;';
      }
      return char;
    });
  }
}
