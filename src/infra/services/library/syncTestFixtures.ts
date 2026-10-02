import { createEmptyLibrarySyncState } from "./syncModel";

export function createLargeSyncFixture(longTitles = false) {
  const state = createEmptyLibrarySyncState();
  let seed = 42;
  const variedTitle = (length: number) => {
    let text = "";
    for (let index = 0; index < length; index += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      text += String.fromCharCode(0x4e00 + (seed % 5000));
    }
    return text;
  };
  for (let index = 0; index < 395; index += 1) {
    const id = `m${10000 + index}`;
    const key = `dm5:${id}`;
    const lastRead = `m${4000000 + index}`;
    state.seriesByKey[key] = {
      site: "dm5",
      comicsID: id,
      title: `測試漫畫 ${index} ${longTitles ? variedTitle(14) : "星空與冒險"}`,
      cover: `https://img.example.com/comics/${id}/cover-1234567890.jpg`,
      url: `https://www.dm5.com/${id}/`,
      latestChapterID: "",
      lastReadChapterID: lastRead,
      readChapterIDs: [lastRead],
      chapterSummaries: {
        [lastRead]: {
          title: "最後閱讀章節",
          href: `https://www.dm5.com/${lastRead}/`,
        },
      },
    };
    state.subscriptions.push(key);
    if (index < 50) state.history.push(key);
  }
  for (let index = 0; index < 4200; index += 1) {
    const seriesKey = state.subscriptions[index % 395];
    const chapterID = `m${2000000 + index}`;
    const series = state.seriesByKey[seriesKey];
    series.latestChapterID = chapterID;
    series.chapterSummaries[chapterID] = {
      title: `第 ${index + 1} 話${longTitles ? ` ${variedTitle(28)}` : ""}`,
      href: `https://www.dm5.com/${chapterID}/`,
    };
    state.updates.push({ seriesKey, chapterID });
  }
  return state;
}
