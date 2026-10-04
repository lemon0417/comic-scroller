export const MANHUAGUI_BASE_URL = "https://www.manhuagui.com";
export const MANHUAGUI_REQUEST_TIMEOUT_MS = 30_000;

export function parseManhuaguiChapterID(chapterID: string) {
  const match = /^comic\/(\d+)\/(\d+)\.html$/.exec(chapterID);
  if (!match) throw new Error("Invalid Manhuagui chapter ID.");
  return { seriesID: match[1], chapterNumber: match[2] };
}

export function parseManhuaguiSeriesURL(url: string) {
  const parsed = new URL(url);
  const match = /^\/comic\/(\d+)\/?$/.exec(parsed.pathname);
  if (parsed.origin !== MANHUAGUI_BASE_URL || !match) {
    throw new Error("Invalid Manhuagui series URL.");
  }
  return match[1];
}
