import { of } from "rxjs";
import navigationEpic from "./navigationEpic";
import {
  fetchImgList,
  navigateChapter,
  stopScroll,
  updateRead,
} from "@domain/actions/reader";
import { resetImg, updateChapterLatestIndex } from "@domain/reducers/comics";

describe("navigationEpic", () => {
  it("dispatches the expected navigation sequence", () => {
    const action$ = of(navigateChapter(3));
    const output$ = navigationEpic(action$);

    const actions: any[] = [];
    output$.subscribe((action) => actions.push(action));

    expect(actions).toEqual([
      stopScroll(),
      resetImg(),
      updateRead(3),
      updateChapterLatestIndex(3),
      fetchImgList(3),
    ]);
  });
});
