import type { PopupFeedEntry } from "@infra/services/library/models";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";

jest.mock("react-redux", () => ({
  connect: () => (Component: unknown) => Component,
}));

import PopupApp from "./index";

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

const TestPopupApp = PopupApp as unknown as ComponentType<any>;

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
    const requestPopupData = jest.fn();

    const { container } = render(
      <TestPopupApp
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
        updateCount={78}
        updatesTruncated
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
        requestPopupData={requestPopupData}
      />,
    );

    expect(requestPopupData).toHaveBeenCalledWith("popup");
    expect(screen.getByText("繼續閱讀")).toBeInTheDocument();
    expect(screen.getByText("最新更新")).toBeInTheDocument();
    expect(
      screen.getByText("僅顯示最新 50 筆，請前往管理頁查看全部。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "閱讀" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Chainsaw Man" }),
    ).toHaveAttribute("href", "https://dm5.com/series");
    expect(
      screen.queryByRole("button", { name: "開啟作品" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".ds-count-badge")).toHaveTextContent("78");

    fireEvent.click(screen.getByRole("button", { name: "管理" }));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test/manage.html?tab=following",
    });
  });

  it("opens continue in the extension reader page", () => {
    const requestPopupData = jest.fn();

    render(
      <TestPopupApp
        hydrationStatus="ready"
        update={[]}
        updateCount={0}
        updatesTruncated={false}
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
        requestPopupData={requestPopupData}
      />,
    );

    expect(requestPopupData).toHaveBeenCalledWith("popup");
    fireEvent.click(screen.getByRole("button", { name: "繼續" }));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test/app.html?site=dm5&chapter=m1123",
    });
  });

  it("does not show the truncation note when the popup has the full update feed", () => {
    render(
      <TestPopupApp
        hydrationStatus="ready"
        update={[createFeedEntry()]}
        updateCount={1}
        updatesTruncated={false}
        continueReading={null}
        requestPopupData={jest.fn()}
      />,
    );

    expect(
      screen.queryByText("僅顯示最新 50 筆，請前往管理頁查看全部。"),
    ).not.toBeInTheDocument();
  });
});
