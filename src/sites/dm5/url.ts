export function dm5ChapterURL(chapterID: string) {
  if (!/^m\d+$/.test(chapterID)) throw new Error("Invalid DM5 chapter ID.");
  return `https://www.dm5.com/${chapterID}/`;
}
