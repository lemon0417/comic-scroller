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
  const match = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`,
    "i",
  ).exec(attributes);
  return match ? decodeHtmlText(match[2]) : "";
}

export function htmlText(html: string) {
  return decodeHtmlText(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}
