export function decodeHtmlText(text: string) {
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return text.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, key: string) => {
      if (!key.startsWith("#")) return entities[key.toLowerCase()] || entity;
      const value =
        key.slice(0, 2).toLowerCase() === "#x"
          ? parseInt(key.slice(2), 16)
          : Number(key.slice(1));
      return value > 0 &&
        value <= 0x10ffff &&
        !(value >= 0xd800 && value <= 0xdfff)
        ? String.fromCodePoint(value)
        : entity;
    },
  );
}

export function readHtmlAttribute(attributes: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
    "i",
  ).exec(attributes);
  return match ? decodeHtmlText(match[2]) : "";
}

export function htmlText(html: string) {
  return decodeHtmlText(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtmlScripts(html: string) {
  return html.replace(
    /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
}

/** Read a nested chapter container without DOM APIs in the service worker. */
export function readHtmlDivContentAt(html: string, offset: number) {
  let start = -1;
  let depth = 0;
  for (const tag of Array.from(
    html.slice(offset).matchAll(/<\/?div\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi),
  )) {
    if (start < 0) {
      if (tag.index !== 0 || /^<\//.test(tag[0])) break;
      start = offset + tag[0].length;
      depth = 1;
      continue;
    }
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (depth === 0) return html.slice(start, offset + tag.index!);
  }
  throw new Error("Incomplete HTML chapter container.");
}

export function readHtmlDivContent(html: string, id: string) {
  const tags = Array.from(html.matchAll(/<\/?div\b[^>]*>/gi));
  let start = -1;
  let depth = 0;
  for (const tag of tags) {
    if (start < 0) {
      if (readHtmlAttribute(tag[0].slice(4, -1), "id") !== id) continue;
      start = tag.index! + tag[0].length;
      depth = 1;
      continue;
    }
    depth += /^<\//.test(tag[0]) ? -1 : 1;
    if (depth === 0) return html.slice(start, tag.index);
  }
  if (start >= 0) throw new Error(`Incomplete chapter container: ${id}.`);
  return undefined;
}
