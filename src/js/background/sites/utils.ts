import { from } from 'rxjs';

export function fetchText$(url: string) {
  return from(fetch(url).then(response => response.text()));
}

export function parseHtml(html: string): Document {
  const Parser = globalThis.DOMParser;
  if (!Parser) {
    throw new Error('DOMParser is not available in this environment.');
  }
  return new Parser().parseFromString(html, 'text/html');
}

export function textContent(node: Element | null | undefined) {
  return node?.textContent?.trim() || '';
}
