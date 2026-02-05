import { map } from 'rxjs';
import { fetchText$, parseHtml, textContent } from './utils';

const baseURL = 'https://www.dm5.com';

export function fetchChapterPage$(url: string) {
  return fetchText$(url).pipe(
    map(html => {
      const doc = parseHtml(html);
      const chapterNodes = doc.querySelectorAll('#chapterlistload li > a');
      const title = textContent(
        doc.querySelector('.banner_detail .info > .title'),
      )
        .split(/\s+/)[0] || '';
      const cover =
        (doc.querySelector('.banner_detail .cover > img') as HTMLImageElement | null)
          ?.src || '';
      const chapterList = Array.from(chapterNodes, node =>
        node.getAttribute('href')?.replace(/\//g, '') || '',
      ).filter(Boolean);
      const chapters = Array.from(chapterNodes).reduce<Record<string, any>>(
        (acc, node) => {
          const href = node.getAttribute('href')?.replace(/\//g, '') || '';
          if (!href) return acc;
          acc[href] = {
            title: textContent(node).replace(/\s+/g, ' '),
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
