import { decompressFromBase64 } from "lz-string";

import { MANHUAGUI_BASE_URL, parseManhuaguiChapterID } from "./url";

const IMAGE_BASE_URL = "https://i.hamreus.com";
const JS_STRING = "'(?:\\\\.|[^'\\\\])*'";
const PACKED_ARGS = new RegExp(
  `return p;\\}\\s*\\(\\s*(${JS_STRING})\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(${JS_STRING})\\s*\\[\\s*(${JS_STRING})\\s*\\]\\s*\\(\\s*(${JS_STRING})\\s*\\)\\s*,\\s*0\\s*,\\s*\\{\\s*\\}\\s*\\)`,
);

function readStringLiteral(literal: string) {
  const escapes: Record<string, string> = {
    n: "\n",
    r: "\r",
    t: "\t",
    b: "\b",
    f: "\f",
  };
  return literal
    .slice(1, -1)
    .replace(
      /\\(x[\da-f]{2}|u[\da-f]{4}|[\\'"/nrtbf])/gi,
      (_match, escape: string) => {
        if (/^[xu]/i.test(escape))
          return String.fromCharCode(parseInt(escape.slice(1), 16));
        return escapes[escape] ?? escape;
      },
    );
}

function encodeSymbol(value: number, base: number): string {
  if (value >= base)
    return (
      encodeSymbol(Math.floor(value / base), base) +
      encodeSymbol(value % base, base)
    );
  return value > 35 ? String.fromCharCode(value + 29) : value.toString(36);
}

function unpackImageData(html: string): unknown {
  if (html.length > 2 * 1024 * 1024)
    throw new Error("Manhuagui chapter response is too large.");
  const args = PACKED_ARGS.exec(html);
  if (!args)
    throw new Error("Manhuagui chapter did not include packed image data.");
  const base = Number(args[2]);
  const count = Number(args[3]);
  if (
    base < 2 ||
    base > 62 ||
    count < 1 ||
    count > 10_000 ||
    readStringLiteral(args[5]) !== "splic" ||
    readStringLiteral(args[6]) !== "|"
  ) {
    throw new Error("Invalid Manhuagui image dictionary.");
  }
  const decoded = decompressFromBase64(readStringLiteral(args[4]));
  if (!decoded || decoded.length > 1024 * 1024)
    throw new Error("Invalid Manhuagui compressed image dictionary.");
  const dictionary = decoded.split("|");
  if (dictionary.length !== count)
    throw new Error("Incomplete Manhuagui image dictionary.");
  const symbols = new Map(
    dictionary.map((word, index) => [encodeSymbol(index, base), word]),
  );
  const script = readStringLiteral(args[1]).replace(
    /\b\w+\b/g,
    (symbol) => symbols.get(symbol) || symbol,
  );
  const data = /^SMH\.imgData\((\{[\s\S]*\})\)\.preInit\(\);?$/.exec(script);
  if (!data) throw new Error("Unsupported Manhuagui image data format.");
  return JSON.parse(data[1]);
}

export function parseManhuaguiChapter(html: string, chapterID: string) {
  const { seriesID, chapterNumber } = parseManhuaguiChapterID(chapterID);
  const value = unpackImageData(html);
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid Manhuagui chapter data.");
  const data = value as Record<string, unknown>;
  if (String(data.bid) !== seriesID || String(data.cid) !== chapterNumber)
    throw new Error("Manhuagui chapter identity mismatch.");
  if (
    typeof data.path !== "string" ||
    !data.path.startsWith("/") ||
    !data.path.endsWith("/") ||
    /[?#\\]/.test(data.path) ||
    data.path.split("/").includes("..") ||
    !Array.isArray(data.files) ||
    data.files.length === 0 ||
    data.files.length !== data.len ||
    !data.files.every(
      (file) =>
        typeof file === "string" &&
        /^[\w.-]+\.(?:jpe?g|png|webp)(?:\.webp)?$/i.test(file) &&
        !file.includes(".."),
    )
  )
    throw new Error("Invalid Manhuagui chapter images.");
  if (!data.sl || typeof data.sl !== "object" || Array.isArray(data.sl))
    throw new Error("Missing Manhuagui image signature.");
  const signature = data.sl as Record<string, unknown>;
  if (
    typeof signature.e !== "number" ||
    !Number.isSafeInteger(signature.e) ||
    signature.e <= 0 ||
    typeof signature.m !== "string" ||
    !/^[\w-]+$/.test(signature.m)
  ) {
    throw new Error("Invalid Manhuagui image signature.");
  }
  const path = data.path;
  const query = new URLSearchParams({ e: String(signature.e), m: signature.m });
  return {
    chapterID,
    seriesID,
    comicUrl: `${MANHUAGUI_BASE_URL}/comic/${seriesID}/`,
    imgList: data.files.map((file: string) => {
      const url = new URL(`${path}${file}`, IMAGE_BASE_URL);
      if (url.origin !== IMAGE_BASE_URL)
        throw new Error("Unsupported Manhuagui image host.");
      url.search = query.toString();
      return { chapter: chapterID, src: url.href };
    }),
  };
}
