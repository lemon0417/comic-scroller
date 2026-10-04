export const EIGHT_COMIC_BASE_URL = "https://www.8comic.com";
export const EIGHT_COMIC_READER_URL = "https://articles.onemoreplace.tw";
export const EIGHT_COMIC_REQUEST_TIMEOUT_MS = 30_000;

export function parseEightComicChapterID(chapterID: string) {
  const match =
    /^online\/new-([1-9]\d*)\.html\?ch=([1-9]\d*)([a-z]?)(?:-[1-9]\d*)?$/.exec(
      chapterID,
    );
  if (!match) throw new Error("Invalid 8comic chapter ID.");
  const [, seriesID, chapterNumber, part] = match;
  return {
    seriesID,
    chapterNumber,
    part,
    chapterID: `online/new-${seriesID}.html?ch=${chapterNumber}${part}`,
  };
}

export function parseEightComicSeriesURL(url: string) {
  const parsed = new URL(url);
  const match = /^\/html\/([1-9]\d*)\.html$/.exec(parsed.pathname);
  if (parsed.origin !== EIGHT_COMIC_BASE_URL || !match) {
    throw new Error("Invalid 8comic series URL.");
  }
  return match[1];
}

export function eightComicSeriesURL(seriesID: string) {
  return `${EIGHT_COMIC_BASE_URL}/html/${seriesID}.html`;
}
