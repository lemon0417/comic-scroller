export const MYCOMIC_BASE_URL = "https://mycomic.com";
export const MYCOMIC_IMAGE_URL = "https://biccam.com";
export const MYCOMIC_REQUEST_TIMEOUT_MS = 30_000;
export const MYCOMIC_REQUEST_OPTIONS = {
  credentials: "include",
  redirect: "error",
  headers: {
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  },
} as const;

function parseSiteURL(url: string) {
  const parsed = new URL(url);
  if (
    parsed.origin !== MYCOMIC_BASE_URL ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("Unsupported MyComic URL.");
  }
  return parsed;
}

export function parseMyComicSeriesURL(url: string) {
  const parsed = parseSiteURL(url);
  const match = /^\/(?:cn\/)?comics\/([1-9]\d*)\/?$/.exec(parsed.pathname);
  if (!match) throw new Error("Invalid MyComic series URL.");
  return match[1];
}

export function myComicSeriesURL(seriesID: string) {
  if (!/^[1-9]\d*$/.test(seriesID))
    throw new Error("Invalid MyComic series ID.");
  return `${MYCOMIC_BASE_URL}/comics/${seriesID}`;
}

export function parseMyComicChapterID(chapterID: string) {
  const match = /^chapters\/([1-9]\d*)$/.exec(chapterID);
  if (!match) throw new Error("Invalid MyComic chapter ID.");
  return match[1];
}

export function parseMyComicChapterURL(url: string) {
  const parsed = parseSiteURL(url);
  const match = /^\/(?:cn\/)?chapters\/([1-9]\d*)\/?$/.exec(parsed.pathname);
  if (!match) throw new Error("Invalid MyComic chapter URL.");
  return `chapters/${match[1]}`;
}

export function myComicChapterURL(chapterID: string) {
  parseMyComicChapterID(chapterID);
  return `${MYCOMIC_BASE_URL}/${chapterID}`;
}

export function parseMyComicImageURL(value: string, pathPrefix: string) {
  const parsed = new URL(value);
  if (
    parsed.origin !== MYCOMIC_IMAGE_URL ||
    parsed.username ||
    parsed.password ||
    !parsed.pathname.startsWith(pathPrefix)
  ) {
    throw new Error("Unsupported MyComic image URL.");
  }
  return parsed.href;
}
