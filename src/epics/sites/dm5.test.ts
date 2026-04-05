import { fetchImgSrc } from "@domain/actions/reader";
import { loadImgSrc } from "@domain/reducers/comics";
import { lastValueFrom, of, Subject } from "rxjs";
import { ajax } from "rxjs/ajax";
import { toArray } from "rxjs/operators";

import { fetchImgSrcEpic } from "./dm5";

jest.mock("rxjs/ajax", () => ({
  ajax: jest.fn(),
}));

describe("dm5 fetchImgSrcEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dedupes in-flight chapterfun requests for the same image", async () => {
    const response$ = new Subject<{ response: string }>();
    const ajaxMock = ajax as unknown as jest.Mock;
    ajaxMock.mockReturnValue(response$);

    const state$ = {
      value: {
        comics: {
          imageList: {
            result: [0],
            entity: {
              0: {
                src: "https://www.dm5.com/manhua-demo/chapterfun.ashx?cid=1&page=1",
                loading: true,
                type: "image",
                cid: "1",
                key: "deadbeef",
              },
            },
          },
        },
      },
    };

    const outputPromise = lastValueFrom(
      fetchImgSrcEpic(
        of(fetchImgSrc(0, 0), fetchImgSrc(0, 0)),
        state$ as any,
      ).pipe(toArray()),
    );

    expect(ajaxMock).toHaveBeenCalledTimes(1);

    response$.next({
      response:
        "var d=['/1_4253.jpg']; var base='https://example.com/85/84472/1753397';",
    });
    response$.complete();

    await expect(outputPromise).resolves.toEqual([
      loadImgSrc(
        "https://example.com/85/84472/1753397/1_4253.jpg?cid=1&key=deadbeef",
        0,
      ),
    ]);
  });
});
