import { SaxesParser } from 'saxes';
import type { ParsedElement } from './parsed-types.js';
import type { ResourceLimits, CanvasSize, AttributeValue } from '../../domain/values/contracts.js';
import type { ContainerRef } from '../../domain/internal/protocols.js';
import type { DecodeResult } from '../../application/ports/SvgCodec.js';
import type { Diagnostic } from '../../application/contracts/api.js';
import { ShapeFactory } from '../../domain/shapes/ShapeFactory.js';
import { SvgDocumentBuilder } from '../../domain/document/SvgDocumentBuilder.js';
import { CanvasRoot } from '../../domain/document/CanvasRoot.js';
import { ValueRules } from '../../domain/values/ValueRules.js';
import { XmlCharacters } from '../../domain/values/XmlCharacters.js';
import { EditorError } from '../../application/errors/EditorError.js';
export class XmlSvgDecoder {
  readonly #factory = new ShapeFactory();
  decode(source: string, limits: ResourceLimits): DecodeResult {
    const rules = new ValueRules(limits);
    if (typeof source !== 'string') throw new EditorError('INVALID_VALUE');
    if (Buffer.byteLength(source, 'utf8') > limits.maxSvgBytes)
      throw new EditorError('RESOURCE_LIMIT', { field: 'bytes' });
    XmlCharacters.validate(source);
    const parser = new SaxesParser({
      xmlns: true,
      defaultXMLVersion: '1.0',
      forceXMLVersion: true,
    });
    const stack: ParsedElement[] = [];
    const preorder: ParsedElement[] = [];
    let root: ParsedElement | undefined;
    let nodeCount = 0;
    const unsupported = () => {
      throw new EditorError('UNSUPPORTED_SVG');
    };
    parser.on('error', unsupported);
    parser.on('doctype', unsupported);
    parser.on('processinginstruction', unsupported);
    parser.on('xmldecl', (decl) => {
      if (
        decl.version !== '1.0' ||
        (decl.encoding !== undefined && decl.encoding.toUpperCase() !== 'UTF-8') ||
        (decl.standalone !== undefined && !['yes', 'no'].includes(decl.standalone))
      )
        unsupported();
    });
    parser.on('opentag', (tag) => {
      if (tag.uri !== 'http://www.w3.org/2000/svg') unsupported();
      const parent = stack.at(-1);
      const isRoot = parent === undefined;
      if (isRoot) {
        if (root || tag.local !== 'svg') unsupported();
      } else {
        if (parent.content !== 'container') unsupported();
        if (++nodeCount > limits.maxNodeCount)
          throw new EditorError('RESOURCE_LIMIT', { field: 'nodes' });
        if (stack.length > limits.maxTreeDepth)
          throw new EditorError('RESOURCE_LIMIT', { field: 'depth' });
      }
      let content: ParsedElement['content'] = 'container';
      if (!isRoot) {
        try {
          content = this.#factory.definition(tag.local).schema.contentModel;
        } catch {
          unsupported();
        }
      }
      const attributes: Record<string, string> = Object.create(null) as Record<string, string>;
      for (const attr of Object.values(tag.attributes)) {
        rules.attribute(attr.value);
        if (attr.uri === 'http://www.w3.org/2000/xmlns/') continue;
        if (attr.uri !== '' || attr.prefix !== '') unsupported();
        attributes[attr.local] = attr.value;
      }
      const element: ParsedElement = {
        type: tag.local,
        content,
        attributes,
        children: [],
        textParts: [],
        textScalars: 0,
      };
      if (parent) parent.children.push(element);
      else root = element;
      if (!isRoot) preorder.push(element);
      stack.push(element);
    });
    const text = (chunk: string) => {
      const parent = stack.at(-1);
      if (!parent || parent.content !== 'text') {
        if (/[^\x20\t\r\n]/.test(chunk)) unsupported();
        return;
      }
      const scalars = chunk[Symbol.iterator]();
      while (!scalars.next().done)
        if (++parent.textScalars > limits.maxTextLength)
          throw new EditorError('RESOURCE_LIMIT', { field: 'text' });
      parent.textParts.push(chunk);
    };
    parser.on('text', text);
    parser.on('cdata', (chunk) => {
      if (stack.at(-1)?.content !== 'text') unsupported();
      text(chunk);
    });
    parser.on('closetag', () => {
      stack.pop();
    });
    parser.write(source).close();
    if (!root || stack.length) unsupported();
    const parsed = root as ParsedElement;
    if (Object.hasOwn(parsed.attributes, 'id')) unsupported();
    const rootAttributes = { ...parsed.attributes };
    const size: CanvasSize = {
      width: rules.numeric(rootAttributes.width, 'positive', 'width', true),
      height: rules.numeric(rootAttributes.height, 'positive', 'height', true),
    };
    delete rootAttributes.width;
    delete rootAttributes.height;
    if (Object.hasOwn(rootAttributes, 'viewBox')) {
      this.viewBox(rootAttributes.viewBox!, size, rules);
      delete rootAttributes.viewBox;
    }
    const normalizedRoot = CanvasRoot.schema.validate(
      rules,
      { attributes: { ...rootAttributes, width: size.width, height: size.height } },
      true,
    );
    const builder = new SvgDocumentBuilder(limits, size, normalizedRoot.attributes);
    const used = new Set<string>();
    const assigned = new Map<ParsedElement, string>();
    for (const element of preorder)
      if (Object.hasOwn(element.attributes, 'id')) {
        const id = rules.id(element.attributes.id);
        if (used.has(id)) throw new EditorError('DUPLICATE_ID', { id });
        used.add(id);
        assigned.set(element, id);
      }
    const counters = new Map<string, number>();
    const warnings: Diagnostic[] = [];
    for (const element of preorder)
      if (!assigned.has(element)) {
        let n = counters.get(element.type) ?? 1;
        while (used.has(`${element.type}${n}`)) n++;
        const id = rules.id(`${element.type}${n}`);
        counters.set(element.type, n + 1);
        used.add(id);
        assigned.set(element, id);
        warnings.push(
          Object.freeze({
            code: 'ASSIGNED_ID',
            parameters: Object.freeze({ id, type: element.type }),
          }),
        );
      }
    const append = (element: ParsedElement, parent: ContainerRef) => {
      const attributes: Record<string, AttributeValue> = { ...element.attributes };
      delete attributes.id;
      const node = builder.append(
        element.type,
        assigned.get(element)!,
        { attributes, ...(element.content === 'text' ? { text: element.textParts.join('') } : {}) },
        parent,
      );
      if (element.children.length) {
        const container = node.asContainer();
        if (!container) unsupported();
        for (const child of element.children) append(child, container!);
      }
    };
    for (const child of parsed.children) append(child, builder.root);
    const document = builder.build();
    return Object.freeze({
      document,
      warnings: Object.freeze(warnings),
      semanticRepair: warnings.length > 0,
    });
  }
  private viewBox(raw: string, size: CanvasSize, rules: ValueRules): void {
    const value = ValueRules.trim(raw);
    const number = '[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?';
    const sep = '(?:[ \\t\\r\\n]+|[ \\t\\r\\n]*,[ \\t\\r\\n]*)';
    if (!new RegExp(`^${number}${sep}${number}${sep}${number}${sep}${number}$`).test(value))
      throw new EditorError('UNSUPPORTED_SVG', { field: 'viewBox' });
    const values = value.split(/[\x20\t\r\n,]+/).map((n) => rules.numeric(n));
    if (values[0] !== 0 || values[1] !== 0 || values[2] !== size.width || values[3] !== size.height)
      throw new EditorError('UNSUPPORTED_SVG', { field: 'viewBox' });
  }
}
