export const BAOZIMH_BASE_URL = "https://www.baozimh.com";
export const BAOZIMH_READER_URL = "https://www.twmanga.com";
export const BAOZIMH_REQUEST_TIMEOUT_MS = 30_000;

const SLUG = "[a-z0-9]+(?:[-_][a-z0-9]+)*";
const SLOT = "(?:0|[1-9]\\d*)";
const CHAPTER_PATH = new RegExp(
  `^comic/chapter/(${SLUG})/(${SLOT})_(${SLOT})(?:_([1-9]\\d*))?\\.html$`,
);

function parseSiteURL(url: string) {
  const parsed = new URL(url);
  if (
    ![BAOZIMH_BASE_URL, BAOZIMH_READER_URL].includes(parsed.origin) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("Unsupported Baozimh URL.");
  }
  return parsed;
}

export function parseBaozimhSeriesURL(url: string) {
  const parsed = parseSiteURL(url);
  const match = new RegExp(`^/comic/(${SLUG})/?$`).exec(parsed.pathname);
  if (!match) throw new Error("Invalid Baozimh series URL.");
  return match[1];
}

export function baozimhSeriesURL(seriesID: string) {
  if (!new RegExp(`^${SLUG}$`).test(seriesID)) {
    throw new Error("Invalid Baozimh series ID.");
  }
  return `${BAOZIMH_BASE_URL}/comic/${seriesID}`;
}

export function parseBaozimhChapterID(requestedID: string) {
  const match = CHAPTER_PATH.exec(requestedID);
  if (!match) throw new Error("Invalid Baozimh chapter ID.");
  const [, seriesID, sectionSlot, chapterSlot, pageSuffix] = match;
  const page = Number(pageSuffix || 1);
  if (!Number.isSafeInteger(page)) {
    throw new Error("Invalid Baozimh chapter page.");
  }
  const chapterID = `comic/chapter/${seriesID}/${sectionSlot}_${chapterSlot}.html`;
  return { chapterID, seriesID, sectionSlot, chapterSlot, page };
}

export function parseBaozimhChapterURL(url: string) {
  const parsed = parseSiteURL(url);
  if (parsed.pathname === "/user/page_direct") {
    const values = ["comic_id", "section_slot", "chapter_slot"].map((key) => {
      if (parsed.searchParams.getAll(key).length !== 1) {
        throw new Error("Invalid Baozimh chapter entry.");
      }
      return parsed.searchParams.get(key)!;
    });
    return parseBaozimhChapterID(
      `comic/chapter/${values[0]}/${values[1]}_${values[2]}.html`,
    );
  }
  return parseBaozimhChapterID(parsed.pathname.slice(1));
}

export function baozimhChapterURL(chapterID: string, page = 1) {
  const parsed = parseBaozimhChapterID(chapterID);
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new Error("Invalid Baozimh chapter page.");
  }
  const path = parsed.chapterID.replace(
    /\.html$/,
    `${page === 1 ? "" : `_${page}`}.html`,
  );
  return `${BAOZIMH_READER_URL}/${path}`;
}
