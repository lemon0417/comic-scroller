import { readHtmlAttribute, stripHtmlScripts } from "../html";
import { isMyComicObject, readMyComicStructuredData } from "./html";
import {
  myComicSeriesURL,
  parseMyComicChapterID,
  parseMyComicChapterURL,
  parseMyComicImageURL,
  parseMyComicSeriesURL,
} from "./url";

export function parseMyComicChapterPage(html: string, chapterID: string) {
  const id = parseMyComicChapterID(chapterID);
  const data = readMyComicStructuredData(html, "ComicIssue");
  if (
    typeof data.url !== "string" ||
    parseMyComicChapterURL(data.url) !== chapterID ||
    !Array.isArray(data.itemListElement)
  ) {
    throw new Error("MyComic chapter identity mismatch.");
  }
  const series = data.itemListElement.find(
    (item: unknown) => isMyComicObject(item) && item.position === 2,
  );
  const chapter = data.itemListElement.find(
    (item: unknown) => isMyComicObject(item) && item.position === 3,
  );
  if (
    !isMyComicObject(series?.item) ||
    typeof series.item.url !== "string" ||
    !isMyComicObject(chapter?.item) ||
    typeof chapter.item.url !== "string" ||
    parseMyComicChapterURL(chapter.item.url) !== chapterID
  ) {
    throw new Error("Invalid MyComic chapter breadcrumbs.");
  }
  const seriesID = parseMyComicSeriesURL(series.item.url);
  html = stripHtmlScripts(html);
  const imgList: { chapter: string; src: string }[] = [];
  let complete = false;
  for (const image of Array.from(html.matchAll(/<img\b([^>]*)>/gi))) {
    if (!readHtmlAttribute(image[1], "class").split(/\s+/).includes("page"))
      continue;
    if (
      complete ||
      readHtmlAttribute(image[1], "x-ref") !== `page-${imgList.length + 1}`
    )
      throw new Error("Incomplete MyComic image sequence.");
    const src = parseMyComicImageURL(
      readHtmlAttribute(image[1], "data-src") ||
        readHtmlAttribute(image[1], "src"),
      `/chapters/${id}/`,
    );
    imgList.push({ chapter: chapterID, src });
    complete =
      readHtmlAttribute(image[1], "x-intersect.once") ===
      "reachedBottomCallback";
  }
  if (!imgList.length || !complete)
    throw new Error("Missing MyComic chapter images.");
  return { chapterID, seriesID, comicUrl: myComicSeriesURL(seriesID), imgList };
}
