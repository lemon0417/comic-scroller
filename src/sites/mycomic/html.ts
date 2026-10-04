import { readHtmlAttribute } from "../html";

export function isMyComicObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readMyComicStructuredData(html: string, expectedType: string) {
  if (html.length > 2 * 1024 * 1024)
    throw new Error("MyComic response is too large.");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const script of Array.from(
    html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
  )) {
    if (readHtmlAttribute(script[1], "type") !== "application/ld+json")
      continue;
    const data: unknown = JSON.parse(script[2]);
    if (
      isMyComicObject(data) &&
      Array.isArray(data["@type"]) &&
      data["@type"].includes(expectedType)
    ) {
      return data;
    }
  }
  throw new Error(`Missing MyComic ${expectedType} metadata.`);
}

/** Extract only the JSON array, leaving Alpine methods as inert text. */
export function readMyComicChapterArray(data: string): unknown[] {
  const start = /^\s*\{\s*chapters:\s*(\[)/.exec(data);
  if (!start) throw new Error("Missing MyComic chapter data.");
  const offset = start[0].length - 1;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = offset; index < data.length; index++) {
    const char = data[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) {
      const chapters: unknown = JSON.parse(data.slice(offset, index + 1));
      if (!Array.isArray(chapters))
        throw new Error("Invalid MyComic chapters.");
      const sorting = /^\s*,\s*decending:\s*(true|false)\s*,/.exec(
        data.slice(index + 1),
      );
      if (!sorting) throw new Error("Missing MyComic chapter sorting.");
      return sorting[1] === "true" ? chapters : chapters.reverse();
    }
  }
  throw new Error("Incomplete MyComic chapter data.");
}
