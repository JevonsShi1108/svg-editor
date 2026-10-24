import { DOMParser } from '@xmldom/xmldom';
// Independent XML oracle. xmldom 0.9 defaults to XML 1.1 newline rules;
// this project explicitly uses XML 1.0 §2.11 (only literal CRLF/CR -> LF).
export const parseXml10 = (source: string) =>
  new DOMParser({
    normalizeLineEndings: (value) => value.replace(/\r\n?/g, '\n'),
    onError: (level, message) => {
      throw new Error(`${level}: ${message}`);
    },
  }).parseFromString(source, 'application/xml');
