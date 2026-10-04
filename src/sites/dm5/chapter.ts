import { withNativeReaderBypass } from "../native";
import { dm5ChapterURL } from "./url";

const baseURL = "https://www.dm5.com";

export { resolveDm5ImageUrl } from "./imageResolver";

type Dm5ChapterImageEntry = {
  chapter: string;
  cid: string;
  href?: string;
  key: string;
  src: string;
  type?: "image" | "paywall";
};

type Dm5ChapterPageMeta = {
  chapterID: string;
  seriesSlug: string;
  imgList: Dm5ChapterImageEntry[];
};

const extractScriptVar = (script: string, name: string) => {
  const match = new RegExp(
    `${name}\\s*=\\s*(?:\\"([^\\"]*)\\"|'([^']*)'|([^;\\n]*))`,
  ).exec(script);
  const value = match ? (match[1] ?? match[2] ?? match[3]) : "";
  return (value || "").trim();
};

const extractSeriesHref = (html: string) => {
  const titleBlockMatch =
    /<div\b[^>]*class\s*=\s*["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(
      html,
    );
  if (!titleBlockMatch) return "";

  const seriesAnchorMatch =
    /<a\b[^>]*href\s*=\s*(["'])(\/manhua-[^"']+\/?)\1/i.exec(
      titleBlockMatch[1],
    );
  return seriesAnchorMatch ? seriesAnchorMatch[2] : "";
};

const parseHtmlChapterPage = (html: string, chapterID: string) => {
  return buildChapterPageMeta(
    chapterID,
    html,
    extractSeriesHref(html),
    extractDm5InputKey(html),
    /id=["']view-chapterpay-btn["']|class=["'][^"']*view-pay-btn/i.test(html),
  );
};

const extractDm5InputKey = (html: string) => {
  const inputMatch = /<input[^>]*dm5_key[^>]*>/i.exec(html);
  if (!inputMatch) return "";

  const valueMatch = /\bvalue=["']([^"']*)["']/i.exec(inputMatch[0]);
  return valueMatch ? valueMatch[1] : "";
};

const buildDm5PaywallHref = (chapterID: string) => {
  return withNativeReaderBypass(dm5ChapterURL(chapterID));
};

const normalizeSlug = (value: string) => value.replace(/^\/+|\/+$/g, "");
const isChapterSlug = (value: string) => /^m\d+$/i.test(value);

const parseSeriesSlug = (comicHref: string, curlRaw: string) => {
  const hrefSlug = normalizeSlug(comicHref);
  if (hrefSlug && !isChapterSlug(hrefSlug)) {
    return hrefSlug;
  }

  const curlSlug = normalizeSlug(curlRaw);
  return isChapterSlug(curlSlug) ? "" : curlSlug;
};

function buildChapterPageMeta(
  chapterID: string,
  scriptText: string,
  comicHref: string,
  dm5KeyFallback: string,
  paywalled: boolean,
): Dm5ChapterPageMeta {
  const imageCount =
    parseInt(extractScriptVar(scriptText, "DM5_IMAGE_COUNT"), 10) || 0;
  const cid = extractScriptVar(scriptText, "DM5_CID");
  const curlRaw = extractScriptVar(scriptText, "DM5_CURL");
  const curl = `${curlRaw.replace(/^\/+/, "").replace(/\/+$/, "")}/`;
  const mid = extractScriptVar(scriptText, "DM5_MID");
  const viewSignDt = extractScriptVar(scriptText, "DM5_VIEWSIGN_DT");
  const viewSign = extractScriptVar(scriptText, "DM5_VIEWSIGN");
  const key = extractScriptVar(scriptText, "DM5_KEY") || dm5KeyFallback;

  if (imageCount <= 0 && paywalled) {
    return {
      chapterID,
      seriesSlug: parseSeriesSlug(comicHref, curlRaw),
      imgList: [
        {
          chapter: chapterID,
          cid,
          href: buildDm5PaywallHref(chapterID),
          key,
          src: "",
          type: "paywall",
        },
      ],
    };
  }

  return {
    chapterID,
    seriesSlug: parseSeriesSlug(comicHref, curlRaw),
    imgList: Array.from({ length: imageCount }, (_v, k) => ({
      src:
        `${baseURL}/${curl}chapterfun.ashx?` +
        `cid=${cid}` +
        `&page=${k + 1}` +
        `&key=` +
        `&language=1` +
        `&gtk=6` +
        `&_cid=${cid}` +
        `&_mid=${mid}` +
        `&_dt=${encodeURIComponent(viewSignDt).replace(/%20/g, "+")}` +
        `&_sign=${viewSign}`,
      chapter: chapterID,
      cid,
      key,
    })),
  };
}

function hasValidChapterPageMeta(meta: Dm5ChapterPageMeta) {
  return (
    Boolean(meta.seriesSlug) &&
    Boolean(meta.chapterID) &&
    meta.imgList.length > 0 &&
    meta.imgList.every((item) =>
      item.type === "paywall"
        ? Boolean(item.href)
        : Boolean(item.cid) && Boolean(item.src),
    )
  );
}

function assertValidChapterPageMeta(
  meta: Dm5ChapterPageMeta,
  chapterID: string,
) {
  if (meta && hasValidChapterPageMeta(meta)) {
    return meta;
  }
  throw new Error(`Unable to parse DM5 chapter metadata for ${chapterID}.`);
}

export function parseDm5ChapterPage(
  html: string,
  chapterID: string,
): Dm5ChapterPageMeta {
  return assertValidChapterPageMeta(
    parseHtmlChapterPage(html, chapterID),
    chapterID,
  );
}
