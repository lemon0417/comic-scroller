import { lastValueFrom, of } from "rxjs";
import { toArray } from "rxjs/operators";
import removeCardEpic from "./removeCardEpic";
import { requestRemoveCard } from "@domain/actions/popup";
import { hydratePopupLibrary } from "@domain/reducers/popupState";
import type { LibrarySnapshotV2 } from "@infra/services/library";

jest.mock("@infra/services/library", () => {
  const actual = jest.requireActual("@infra/services/library");
  return {
    ...actual,
    loadLibrary: jest.fn(),
    saveLibrary: jest.fn(),
  };
});

const { loadLibrary, saveLibrary } = jest.requireMock("@infra/services/library");

describe("removeCardEpic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).chrome = {
      action: { setBadgeText: jest.fn() },
    };
  });

  it("removes update card and rehydrates popup state", async () => {
    const store: LibrarySnapshotV2 = {
      schemaVersion: 2 as const,
      version: "0.0.0",
      history: [],
      subscriptions: [],
      updates: [
        { seriesKey: "dm5:c1", chapterID: "ch1", createdAt: 1 },
        { seriesKey: "dm5:c2", chapterID: "ch2", createdAt: 2 },
      ],
      seriesByKey: {
        "dm5:c1": {
          site: "dm5",
          comicsID: "c1",
          title: "A",
          cover: "",
          url: "",
          chapterList: ["ch1"],
          chapters: { ch1: { title: "Ch1", href: "" } },
          lastRead: "",
          read: [],
        },
        "dm5:c2": {
          site: "dm5",
          comicsID: "c2",
          title: "B",
          cover: "",
          url: "",
          chapterList: ["ch2"],
          chapters: { ch2: { title: "Ch2", href: "" } },
          lastRead: "",
          read: [],
        },
      },
    };
    const nextStore: LibrarySnapshotV2 = {
      ...store,
      updates: [{ seriesKey: "dm5:c2", chapterID: "ch2", createdAt: 2 }],
    };
    loadLibrary.mockResolvedValue(store);
    saveLibrary.mockResolvedValue(nextStore);

    const actions = await lastValueFrom(
      removeCardEpic(
        of(
          requestRemoveCard({
            category: "update",
            index: "0",
            comicsID: "c1",
            chapterID: "ch1",
            site: "dm5",
          }),
        ),
      ).pipe(toArray()),
    );

    expect(actions).toEqual([hydratePopupLibrary(nextStore, "load")]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "1" });
  });
});
