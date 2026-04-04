import { fireEvent, render, screen } from "@testing-library/react";
import type { PopupFeedEntry } from "@infra/services/library/models";
import { PopupApp } from "./index";

function createFeedEntry(
  overrides: Partial<PopupFeedEntry> = {},
): PopupFeedEntry {
  return {
    category: "update",
    key: "feed_1",
    index: 0,
    site: "dm5",
    siteLabel: "DM5",
    comicsID: "123",
    chapterID: "",
    lastReadChapterID: "",
    lastChapterID: "",
    updateChapterID: "",
    continueChapterID: "",
    title: "One Piece",
    url: "https://dm5.com/series",
    cover: "cover.jpg",
    lastReadTitle: "",
    lastReadHref: "",
    lastChapterTitle: "",
    lastChapterHref: "",
    updateChapterTitle: "",
    updateChapterHref: "",
    continueHref: "",
    ...overrides,
  };
}

describe("PopupApp", () => {
  beforeEach(() => {
    (global as any).chrome = {
      runtime: {
        getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
      },
      tabs: {
        create: jest.fn(),
      },
    };
  });

  it("renders updates-first content and opens the manage page", () => {
    render(
      <PopupApp
        hydrationStatus="ready"
        update={[
          createFeedEntry({
            key: "update_1",
            title: "Chainsaw Man",
            siteLabel: "DM5",
            cover: "cover.jpg",
            updateChapterTitle: "Ch 201",
            lastChapterTitle: "Ch 201",
            updateChapterHref: "https://dm5.com/ch201",
            lastChapterHref: "https://dm5.com/ch201",
            lastReadTitle: "Ch 200",
            url: "https://dm5.com/series",
          }),
        ]}
        continueReading={createFeedEntry({
          category: "history",
          key: "history_1",
          title: "One Piece",
          siteLabel: "DM5",
          cover: "cover-2.jpg",
          lastReadTitle: "Ch 1123",
          lastChapterTitle: "Ch 1124",
          continueHref: "https://dm5.com/op-1123",
        })}
        requestPopupData={jest.fn()}
      />,
    );

    expect(screen.getByText("Continue reading")).toBeInTheDocument();
    expect(screen.getByText("New updates")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Read update" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open Library" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test/manage.html?tab=following",
    });
  });

  it("opens continue in the extension reader page", () => {
    render(
      <PopupApp
        hydrationStatus="ready"
        update={[]}
        continueReading={createFeedEntry({
          category: "history",
          key: "history_1",
          title: "One Piece",
          site: "dm5",
          siteLabel: "DM5",
          cover: "cover-2.jpg",
          lastReadTitle: "Ch 1123",
          lastChapterTitle: "Ch 1124",
          continueChapterID: "m1123",
          continueHref: "https://www.dm5.com/m1123/",
        })}
        requestPopupData={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test/app.html?site=dm5&chapter=m1123",
    });
  });
});
