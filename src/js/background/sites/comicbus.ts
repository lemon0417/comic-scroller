import { map } from 'rxjs';
import { fetchText$, parseHtml, textContent } from './utils';

const baseURL = 'http://www.comicbus.com';

function buildChapterList(nodes: Element[]) {
  return nodes
    .map(node => {
      const match = /\'(.*)-(.*)\.html/.exec(node.getAttribute('onclick') || '');
      if (!match) return '';
      return `comic-${match[1]}.html?ch=${match[2]}`;
    })
    .filter(Boolean)
    .reverse();
}

function buildChapters(nodes: Element[], prefix: string) {
  return nodes.reduce<Record<string, any>>((acc, node) => {
    const match = /\'(.*)-(.*)\.html/.exec(node.getAttribute('onclick') || '');
    if (!match) return acc;
    const key = `${prefix}${match[1]}.html?ch=${match[2]}`;
    acc[key] = {
      title:
        node.children.length > 0
          ? textContent(node.children[0])
          : textContent(node),
      href: `${baseURL}/online/${key}`,
    };
    return acc;
  }, {});
}

export function fetchChapterPage$(url: string, comicsID: string) {
  return fetchText$(url).pipe(
    map(html => {
      const doc = parseHtml(html);
      const chapterNodes = Array.from(doc.querySelectorAll('.ch'));
      const volNodes = Array.from(doc.querySelectorAll('.vol'));
      const title = doc.title.split(',')[0] || '';
      const cover = `${baseURL}/pics/0/${comicsID}.jpg`;
      const chapterList = [
        ...buildChapterList(chapterNodes),
        ...buildChapterList(volNodes),
      ];
      const chapters = {
        ...buildChapters(chapterNodes, 'comic-'),
        ...buildChapters(volNodes, 'comic-'),
      };
      return { title, cover, chapterList, chapters, baseURL };
    }),
  );
}
