import { map } from 'rxjs';
import { fetchText$ } from './utils';

const baseURL = 'http://www.comicbus.com';

const stripTags = (input: string) =>
  input.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function extractNodes(html: string, className: string) {
  const regex = new RegExp(
    `<[^>]*class="[^"]*${className}[^"]*"[^>]*onclick="[^"]*'(comic-[^']+\\.html\\?ch=[^']+)'[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
    'gi',
  );
  const nodes: Array<{ key: string; title: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    nodes.push({
      key: match[1],
      title: stripTags(match[2]) || match[1],
    });
  }
  return nodes;
}

function buildChapterList(nodes: Array<{ key: string }>) {
  return nodes.map(node => node.key).filter(Boolean).reverse();
}

function buildChapters(nodes: Array<{ key: string; title: string }>) {
  return nodes.reduce<Record<string, any>>((acc, node) => {
    acc[node.key] = {
      title: node.title,
      href: `${baseURL}/online/${node.key}`,
    };
    return acc;
  }, {});
}

export function fetchChapterPage$(url: string, comicsID: string) {
  return fetchText$(url).pipe(
    map(html => {
      const chapterNodes = extractNodes(html, 'ch');
      const volNodes = extractNodes(html, 'vol');
      const titleMatch = /<title>([^<]+)<\/title>/i.exec(html);
      const title = (titleMatch ? stripTags(titleMatch[1]) : '').split(',')[0] || '';
      const cover = `${baseURL}/pics/0/${comicsID}.jpg`;
      const chapterList = [
        ...buildChapterList(chapterNodes),
        ...buildChapterList(volNodes),
      ];
      const chapters = {
        ...buildChapters(chapterNodes),
        ...buildChapters(volNodes),
      };
      return { title, cover, chapterList, chapters, baseURL };
    }),
  );
}
