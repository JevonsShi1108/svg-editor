import { SaxesParser } from 'saxes';

export interface OutlineElement {
  readonly name: string;
  readonly start: number;
  readonly openingEnd: number;
  readonly end: number;
  readonly parent: number | undefined;
}

export class SvgOutline {
  parse(source: string): readonly OutlineElement[] {
    const parser = new SaxesParser({ xmlns: true });
    const elements: Array<OutlineElement & { end: number }> = [];
    const stack: number[] = [];
    let start = 0;
    parser.on('opentagstart', () => {
      // The name delimiter has just been consumed, before any attribute value.
      start = source.lastIndexOf('<', parser.position - 1);
    });
    parser.on('opentag', (tag) => {
      const id = tag.attributes.id?.value;
      const index = elements.length;
      elements.push({
        name: id ? `${tag.name}#${id}` : tag.name,
        start,
        openingEnd: parser.position,
        end: parser.position,
        parent: stack.at(-1),
      });
      stack.push(index);
    });
    parser.on('closetag', () => {
      const index = stack.pop()!;
      elements[index]!.end = parser.position;
    });
    try {
      parser.write(source).close();
      return elements;
    } catch {
      // The next editor request starts with a fresh parser and the current buffer.
      return [];
    }
  }
}
