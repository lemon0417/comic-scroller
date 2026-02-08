import { from } from "rxjs";
import { map as rxMap } from "rxjs/operators";

const baseURL = "http://www.comicbus.com";

const stripTags = (input: string) =>
  input
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseFromDocument = (doc: Document, comicsID: string) => {
  const chapterNodes = doc.querySelectorAll(".ch");
  const volNodes = doc.querySelectorAll(".vol");
  const title = doc.title.split(",")[0];
  const cover = `${baseURL}/pics/0/${comicsID}.jpg`;
  const parseOnclick = (node: Element) => {
    const onclick = node.getAttribute("onclick") || "";
    const arr = /\'(.*)-(.*)\.html/.exec(onclick);
    if (!arr) return null;
    return { comic: arr[1], chapter: arr[2] };
  };
  const chapterList = [
    ...Array.from(chapterNodes)
      .map((n) => {
        const parsed = parseOnclick(n);
        return parsed
          ? `comic-${parsed.comic}.html?ch=${parsed.chapter}`
          : null;
      })
      .filter(Boolean)
      .reverse(),
    ...Array.from(volNodes)
      .map((n) => {
        const parsed = parseOnclick(n);
        return parsed
          ? `comic-${parsed.comic}.html?ch=${parsed.chapter}`
          : null;
      })
      .filter(Boolean)
      .reverse(),
  ] as string[];
  const chapters = {
    ...Array.from(chapterNodes).reduce<Record<string, any>>((acc, n) => {
      const parsed = parseOnclick(n);
      if (!parsed) return acc;
      acc[`comic-${parsed.comic}.html?ch=${parsed.chapter}`] = {
        title:
          n.children.length > 0 ? n.children[0].textContent : n.textContent,
        href: `${baseURL}/online/comic-${parsed.comic}.html?ch=${parsed.chapter}`,
      };
      return acc;
    }, {}),
    ...Array.from(volNodes).reduce<Record<string, any>>((acc, n) => {
      const parsed = parseOnclick(n);
      if (!parsed) return acc;
      acc[`comic-${parsed.comic}.html?ch=${parsed.chapter}`] = {
        title:
          n.children.length > 0 ? n.children[0].textContent : n.textContent,
        href: `${baseURL}/online/comic-${parsed.comic}.html?ch=${parsed.chapter}`,
      };
      return acc;
    }, {}),
  };
  return { title, cover, chapterList, chapters };
};

const parseFromHtml = (html: string, comicsID: string) => {
  const extractNodes = (className: string) => {
    const regex = new RegExp(
      `<[^>]*class="[^"]*${className}[^"]*"[^>]*onclick="[^"]*'(comic-[^']+\\.html\\?ch=[^']+)'[^"]*"[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
      "gi",
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
  };

  const buildChapterList = (nodes: Array<{ key: string }>) =>
    nodes
      .map((node) => node.key)
      .filter(Boolean)
      .reverse();

  const buildChapters = (nodes: Array<{ key: string; title: string }>) =>
    nodes.reduce<Record<string, any>>((acc, node) => {
      acc[node.key] = {
        title: node.title,
        href: `${baseURL}/online/${node.key}`,
      };
      return acc;
    }, {});

  const chapterNodes = extractNodes("ch");
  const volNodes = extractNodes("vol");
  const titleMatch = /<title>([^<]+)<\/title>/i.exec(html);
  const title =
    (titleMatch ? stripTags(titleMatch[1]) : "").split(",")[0] || "";
  const cover = `${baseURL}/pics/0/${comicsID}.jpg`;
  const chapterList = [
    ...buildChapterList(chapterNodes),
    ...buildChapterList(volNodes),
  ];
  const chapters = {
    ...buildChapters(chapterNodes),
    ...buildChapters(volNodes),
  };
  return { title, cover, chapterList, chapters };
};

export function fetchMeta$(url: string, comicsID: string) {
  return from(fetch(url).then((response) => response.text())).pipe(
    rxMap((html) => {
      const Parser = globalThis.DOMParser;
      if (Parser) {
        const doc = new Parser().parseFromString(html, "text/html");
        return parseFromDocument(doc, comicsID);
      }
      return parseFromHtml(html, comicsID);
    }),
  );
}
