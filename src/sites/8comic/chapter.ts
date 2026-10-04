import { eightComicSeriesURL, parseEightComicChapterID } from "./url";

const IDENTIFIER = "[a-zA-Z_$][\\w$]*";
const RECORD_SIZE = 47;
const TAIL_SIZE = 83;
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function decodeNumber(value: string) {
  if (!/^[a-zA-Z]{2}$/.test(value))
    throw new Error("Invalid 8comic encoded number.");
  return value[0] === "Z"
    ? 8000 + ALPHABET.indexOf(value[1])
    : ALPHABET.indexOf(value[0]) * 52 + ALPHABET.indexOf(value[1]);
}

type Field = { offset: number; length: number };

function parseImageTable(html: string) {
  if (html.length > 2 * 1024 * 1024)
    throw new Error("8comic chapter response is too large.");
  const script = Array.from(
    html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi),
  )
    .map((match) => match[1])
    .find(
      (body) =>
        /\bvar\s+ti\s*=\s*\d+\s*;/.test(body) && body.includes("#comics-pics"),
    );
  if (!script) throw new Error("Missing 8comic image data.");
  const numericBindings = new Map(
    Array.from(
      script.matchAll(
        new RegExp(`\\bvar\\s+(${IDENTIFIER})\\s*=\\s*(\\d+)\\s*;`, "g"),
      ),
      (match) => [match[1], Number(match[2])],
    ),
  );
  const strings = new Map(
    Array.from(
      script.matchAll(
        new RegExp(
          `\\bvar\\s+(${IDENTIFIER})\\s*=\\s*'([a-zA-Z0-9]+)'\\s*;`,
          "g",
        ),
      ),
      (match) => [match[1], match[2]],
    ),
  );
  const tail = new RegExp(
    `(?:^|[\\s(;])(${IDENTIFIER})\\.substring\\(\\1\\.length\\s*-\\s*47\\s*-`,
  ).exec(script);
  const packedName = tail?.[1];
  const packed = packedName ? strings.get(packedName) : undefined;
  const loop =
    /for\s*\(\s*var i=0;i<(\d+);i\+\+\)\s*\{([\s\S]*?)\bbreak;\s*\}/.exec(
      script,
    );
  const count = Number(loop?.[1]);
  if (
    !packed ||
    !loop ||
    count < 1 ||
    count > 10_000 ||
    packed.length !== count * RECORD_SIZE + TAIL_SIZE
  ) {
    throw new Error("Invalid 8comic image table.");
  }
  // The site changes both variable names and column order. Resolve roles from usage,
  // accepting only literal offsets and the observed addition/subtraction stride.
  const fields = new Map<string, Field>();
  let sliceName = "";
  const fieldPattern = new RegExp(
    `var\\s+(${IDENTIFIER})=lc\\((${IDENTIFIER})\\((${IDENTIFIER}),i\\*\\((${IDENTIFIER})([+-])(\\d+)\\)\\+(\\d+)(?:,(\\d+))?\\)\\);`,
    "g",
  );
  for (const match of Array.from(loop[2].matchAll(fieldPattern))) {
    const strideBase = numericBindings.get(match[4]);
    const stride =
      strideBase === undefined
        ? NaN
        : strideBase + (match[5] === "+" ? 1 : -1) * Number(match[6]);
    if (
      match[3] !== packedName ||
      stride !== RECORD_SIZE ||
      (sliceName && sliceName !== match[2])
    )
      throw new Error("Unsupported 8comic image layout.");
    sliceName = match[2];
    fields.set(match[1], {
      offset: Number(match[7]),
      length: match[8] ? Number(match[8]) : 40,
    });
  }
  const helper = Array.from(
    script.matchAll(
      new RegExp(
        `function\\s+(${IDENTIFIER})\\((${IDENTIFIER}),(${IDENTIFIER}),(${IDENTIFIER})\\)\\{([^{}]*)\\}`,
        "g",
      ),
    ),
  ).find((match) => match[1] === sliceName);
  const helperBody =
    helper &&
    new RegExp(
      `^if\\((${IDENTIFIER})==null\\)\\1=40;var(${IDENTIFIER})=\\((${IDENTIFIER})\\+''\\)\\.substring\\((${IDENTIFIER}),\\4\\+\\1\\);return\\(\\2\\);$`,
    ).exec(helper[5].replace(/\s+/g, ""));
  if (
    !helper ||
    !helperBody ||
    helperBody[1] !== helper[4] ||
    helperBody[3] !== helper[2] ||
    helperBody[4] !== helper[3]
  ) {
    throw new Error("Unsupported 8comic substring helper.");
  }
  const chapterName = new RegExp(`if\\((${IDENTIFIER})==ch\\s*&&`).exec(
    loop[2],
  )?.[1];
  const pagesName = new RegExp(`\\bps=(${IDENTIFIER});`).exec(loop[2])?.[1];
  const partName = new RegExp(`\\bpart==(${IDENTIFIER})\\)`).exec(loop[2])?.[1];
  const imageExpression =
    /<img s="'\+([\s\S]*?)\+'" draggable/.exec(script)?.[1] || "";
  // Identifiers are compared as strings rather than interpolated into a regex.
  const slices = Array.from(
    imageExpression.matchAll(
      new RegExp(
        `(${IDENTIFIER})\\((${IDENTIFIER}),\\s*(0|1|mm\\(j\\)),\\s*(1|3)\\)`,
        "g",
      ),
    ),
  ).filter((match) => match[1] === sliceName);
  const serverName = slices.find(
    (match) => match[3] === "0" && match[4] === "1",
  )?.[2];
  const seedName = slices.find(
    (match) => match[3] === "mm(j)" && match[4] === "3",
  )?.[2];
  if (
    !slices.some(
      (match) =>
        match[2] === serverName && match[3] === "1" && match[4] === "1",
    )
  )
    throw new Error("Unsupported 8comic image host layout.");
  const roles = [serverName, seedName, pagesName, chapterName, partName];
  const sizes = [2, 40, 2, 2, 1];
  const layout = roles.map((name) => (name ? fields.get(name) : undefined));
  if (
    fields.size !== 5 ||
    new Set(roles).size !== 5 ||
    layout.some((field, index) => !field || field.length !== sizes[index])
  )
    throw new Error("Unsupported 8comic image fields.");
  const occupied = new Set<number>();
  for (const field of layout as Field[]) {
    for (
      let index = field.offset;
      index < field.offset + field.length;
      index += 1
    ) {
      if (index < 0 || index >= RECORD_SIZE || occupied.has(index))
        throw new Error("Invalid 8comic image field offset.");
      occupied.add(index);
    }
  }
  for (const [index, expected] of Array.from(
    ["jpg", "ic.", "com", "img", "Img", "The"].entries(),
  )) {
    const hex = packed.slice(
      packed.length - 47 - (index + 1) * 6,
      packed.length - 47 - index * 6,
    );
    if (
      !/^[\da-f]{6}$/i.test(hex) ||
      hex
        .match(/../g)!
        .map((pair) => String.fromCharCode(parseInt(pair, 16)))
        .join("") !== expected
    )
      throw new Error("Unsupported 8comic image host or extension.");
  }
  return {
    packed,
    count,
    layout: layout as Field[],
    seriesID: String(numericBindings.get("ti")),
  };
}

export function parseEightComicChapter(html: string, requestedID: string) {
  const { chapterID, seriesID, chapterNumber, part } =
    parseEightComicChapterID(requestedID);
  const table = parseImageTable(html);
  if (table.seriesID !== seriesID)
    throw new Error("8comic chapter identity mismatch.");
  for (let index = 0; index < table.count; index += 1) {
    const [serverCode, seed, pageCode, chapterCode, rowPart] = table.layout.map(
      (field) =>
        table.packed.slice(
          index * RECORD_SIZE + field.offset,
          index * RECORD_SIZE + field.offset + field.length,
        ),
    );
    const rowChapter = decodeNumber(chapterCode);
    if (String(rowChapter) !== chapterNumber || (part && part !== rowPart))
      continue;
    const server = String(decodeNumber(serverCode));
    const pages = decodeNumber(pageCode);
    if (
      !/^[1-9]\d$/.test(server) ||
      !/^[a-zA-Z0-9]{40}$/.test(seed) ||
      !/^(?:0|[a-z])$/.test(rowPart) ||
      pages < 1 ||
      rowChapter < 1
    )
      throw new Error("Invalid 8comic chapter images.");
    const folder = `${rowChapter}${rowPart === "0" ? "" : rowPart}`;
    const imgList = Array.from({ length: pages }, (_, pageIndex) => {
      const page = pageIndex + 1;
      const offset = (Math.floor(pageIndex / 10) % 10) + (pageIndex % 10) * 3;
      const url = new URL(
        `https://img${server[0]}.8comic.com/${server[1]}/${seriesID}/${folder}/${String(page).padStart(3, "0")}_${seed.slice(offset, offset + 3)}.jpg`,
      );
      if (!/^img[1-9]\.8comic\.com$/.test(url.hostname))
        throw new Error("Unsupported 8comic image host.");
      return { chapter: chapterID, src: url.href };
    });
    return {
      chapterID,
      seriesID,
      comicUrl: eightComicSeriesURL(seriesID),
      imgList,
    };
  }
  // Native code falls through to the last row when the requested chapter is absent.
  throw new Error("8comic chapter was not found in the image table.");
}
