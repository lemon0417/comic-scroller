import type { ChapterGroup } from "./series";

export function validateChapterGroups(
  chapterList: string[],
  chapterGroups: ChapterGroup[],
) {
  if (!Array.isArray(chapterGroups) || chapterGroups.length === 0) {
    throw new Error("Chapter groups must be a non-empty list.");
  }
  const groupIDs = new Set<string>();
  const chapterIDs = new Set<string>();
  const flattened: string[] = [];
  for (const group of chapterGroups) {
    if (
      !group ||
      typeof group.id !== "string" ||
      !group.id.trim() ||
      group.id !== group.id.trim() ||
      groupIDs.has(group.id) ||
      !Array.isArray(group.chapterList) ||
      group.chapterList.length === 0
    ) {
      throw new Error("Invalid chapter group.");
    }
    groupIDs.add(group.id);
    for (const chapterID of group.chapterList) {
      if (
        typeof chapterID !== "string" ||
        !chapterID.trim() ||
        chapterID !== chapterID.trim() ||
        chapterIDs.has(chapterID)
      ) {
        throw new Error("Invalid chapter group membership.");
      }
      chapterIDs.add(chapterID);
      flattened.push(chapterID);
    }
  }
  if (
    flattened.length !== chapterList.length ||
    flattened.some((chapterID, index) => chapterID !== chapterList[index])
  ) {
    throw new Error("Chapter groups must match the chapter list.");
  }
}

export function getChapterGroupCheckpoints(chapterGroups: ChapterGroup[]) {
  return Object.fromEntries(
    chapterGroups.map(({ id, chapterList }) => [id, chapterList[0]]),
  );
}
