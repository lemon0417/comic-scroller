import { map } from 'rxjs';
import { fetchText$, parseHtml, textContent } from './utils';

const baseURL = 'http://comic.sfacg.com';

export function fetchChapterPage$(url: string) {
  return fetchText$(url).pipe(
    map(html => {
      const doc = parseHtml(html);
      const chapterNodes = doc.querySelectorAll(
        '.serialise_list.Blue_link2 > li > a',
      );
      const title = textContent(
        doc.querySelector(
          'body > table > tbody > tr > td:nth-child(1) > table:nth-child(2) > tbody > tr > td > h1 > b',
        ),
      );
      const cover =
        (doc.querySelector('.comic_cover > img') as HTMLImageElement | null)
          ?.src || '';
      const chapterList = Array.from(chapterNodes, node =>
        node.getAttribute('href')?.replace(/^(\/)/g, '') || '',
      ).filter(Boolean);
      const chapters = Array.from(chapterNodes).reduce<Record<string, any>>(
        (acc, node) => {
          const href = node.getAttribute('href')?.replace(/^(\/)/g, '') || '';
          if (!href) return acc;
          acc[href] = {
            title: textContent(node),
            href: (node as HTMLAnchorElement).href,
          };
          return acc;
        },
        {},
      );
      return { title, cover, chapterList, chapters, baseURL };
    }),
  );
}
