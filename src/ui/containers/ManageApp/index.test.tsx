import type { PopupFeedEntry } from "@infra/services/library/models";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";

jest.mock("react-redux", () => ({
  connect: () => (Component: unknown) => Component,
}));

import ManageApp from "./index";

function createFeedEntry(
  overrides: Partial<PopupFeedEntry> = {},
): PopupFeedEntry {
  return {
    category: "history",
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

const TestManageApp = ManageApp as unknown as ComponentType<any>;

describe("ManageApp", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/manage.html?tab=history");
    (global as any).ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    (global as any).chrome = {
      runtime: {
        getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
      },
      tabs: {
        create: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).ResizeObserver;
  });

  it("opens a modal and removes only the history entry after confirmation", () => {
    const requestRemoveCard = jest.fn();
    const requestPopupData = jest.fn();

    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        update={[]}
        subscribe={[]}
        history={[
          createFeedEntry({
            key: "history_1",
            index: 0,
            title: "One Piece",
            siteLabel: "DM5",
            site: "dm5",
            comicsID: "123",
            cover: "cover.jpg",
            lastReadTitle: "Ch 1123",
            lastChapterTitle: "Ch 1124",
            continueHref: "https://dm5.com/op-1123",
          }),
        ]}
        continueReading={null}
        requestPopupData={requestPopupData}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={requestRemoveCard}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    expect(requestPopupData).toHaveBeenCalledWith("manage");
    fireEvent.click(screen.getByRole("button", { name: "移除" }));

    expect(
      screen.getByRole("dialog", { name: "移除閱讀紀錄" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(requestRemoveCard).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "移除" }));
    fireEvent.click(screen.getByRole("button", { name: "移除紀錄" }));

    expect(requestRemoveCard).toHaveBeenCalledWith({
      category: "history",
      index: 0,
      comicsID: "123",
      site: "dm5",
    });
  });

  it("runs export from the options tab", () => {
    const requestExportConfig = jest.fn();
    const requestPopupData = jest.fn();

    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        update={[]}
        subscribe={[]}
        history={[]}
        continueReading={null}
        requestPopupData={requestPopupData}
        requestExportConfig={requestExportConfig}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={jest.fn()}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    expect(requestPopupData).toHaveBeenCalledWith("manage");
    fireEvent.click(screen.getByRole("tab", { name: "選項" }));
    fireEvent.click(screen.getByRole("button", { name: "匯出設定" }));

    expect(requestExportConfig).toHaveBeenCalled();
  });

  it("renders the extension release notice and supports dismissing it", () => {
    const requestDismissExtensionReleaseNotice = jest.fn();

    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        extensionReleaseNotice={{
          latestVersion: "4.2.0",
          releaseUrl:
            "https://github.com/lemon0417/comic-scroller/releases/tag/v4.2.0",
          instructionsUrl:
            "https://lemon0417.github.io/comic-scroller/install/",
          publishedAt: "2026-04-09T12:00:00.000Z",
        }}
        exportUrl=""
        exportFilename=""
        update={[]}
        subscribe={[]}
        history={[]}
        continueReading={null}
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={jest.fn()}
        requestDismissExtensionReleaseNotice={
          requestDismissExtensionReleaseNotice
        }
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    expect(
      screen.getByText("Comics Scroller 4.2.0 已發布"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "稍後提醒" }));

    expect(requestDismissExtensionReleaseNotice).toHaveBeenCalledWith("4.2.0");
  });

  it("opens an abandon modal and unsubscribes without cascade delete by default", () => {
    const requestRemoveCard = jest.fn();

    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        update={[]}
        subscribe={[
          createFeedEntry({
            category: "subscribe",
            key: "subscribe_1",
            title: "One Piece",
            siteLabel: "DM5",
            site: "dm5",
            comicsID: "123",
            cover: "cover.jpg",
            lastReadTitle: "Ch 1123",
            lastChapterTitle: "Ch 1124",
            continueChapterID: "m1123",
            continueHref: "https://www.dm5.com/m1123/",
          }),
        ]}
        history={[]}
        continueReading={null}
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={requestRemoveCard}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "追蹤 1" }));
    fireEvent.click(screen.getByRole("button", { name: "棄坑" }));
    const dialog = screen.getByRole("dialog", { name: "棄坑作品" });

    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("checkbox", {
        name: "一併清除閱讀紀錄與作品資料",
      }),
    ).not.toBeChecked();

    fireEvent.click(within(dialog).getByRole("button", { name: "確認棄坑" }));

    expect(requestRemoveCard).toHaveBeenCalledWith({
      category: "subscribe",
      index: 0,
      comicsID: "123",
      site: "dm5",
    });
  });

  it("can request cascade delete from the abandon modal", () => {
    const requestRemoveCard = jest.fn();

    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        update={[]}
        subscribe={[
          createFeedEntry({
            category: "subscribe",
            key: "subscribe_1",
            title: "One Piece",
            siteLabel: "DM5",
            site: "dm5",
            comicsID: "123",
            cover: "cover.jpg",
            lastReadTitle: "Ch 1123",
            lastChapterTitle: "Ch 1124",
            continueChapterID: "m1123",
            continueHref: "https://www.dm5.com/m1123/",
          }),
        ]}
        history={[]}
        continueReading={null}
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={requestRemoveCard}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "追蹤 1" }));
    fireEvent.click(screen.getByRole("button", { name: "棄坑" }));
    const dialog = screen.getByRole("dialog", { name: "棄坑作品" });
    fireEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "一併清除閱讀紀錄與作品資料",
      }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "確認棄坑" }));

    expect(requestRemoveCard).toHaveBeenCalledWith({
      category: "subscribe",
      index: 0,
      comicsID: "123",
      clearSeriesData: true,
      site: "dm5",
    });
  });

  it("opens continue in the extension reader page", () => {
    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        update={[]}
        subscribe={[
          createFeedEntry({
            category: "subscribe",
            key: "subscribe_1",
            title: "One Piece",
            siteLabel: "DM5",
            site: "dm5",
            comicsID: "123",
            cover: "cover.jpg",
            lastReadTitle: "Ch 1123",
            lastChapterTitle: "Ch 1124",
            continueChapterID: "m1123",
            continueHref: "https://www.dm5.com/m1123/",
          }),
        ]}
        history={[]}
        continueReading={null}
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={jest.fn()}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "追蹤 1" }));
    fireEvent.click(screen.getByRole("button", { name: "繼續" }));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test/app.html?site=dm5&chapter=m1123",
    });
  });

  it("opens a reset modal before resetting data", () => {
    const requestResetConfig = jest.fn();

    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        update={[]}
        subscribe={[]}
        history={[]}
        continueReading={null}
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={requestResetConfig}
        requestRemoveCard={jest.fn()}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "選項" }));
    fireEvent.click(screen.getByRole("button", { name: "重置資料" }));
    const dialog = screen.getByRole("dialog", { name: "重置資料" });
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "重置資料" }));

    expect(requestResetConfig).toHaveBeenCalled();
  });

  it("virtualizes large following lists", () => {
    const subscribe = Array.from({ length: 200 }, (_, index) =>
      createFeedEntry({
        category: "subscribe",
        key: `subscribe_${index}`,
        index,
        title: `Series ${index}`,
        siteLabel: "DM5",
        site: "dm5",
        comicsID: `series-${index}`,
        continueChapterID: `m${index}`,
      }),
    );

    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        update={[]}
        subscribe={subscribe}
        history={[]}
        continueReading={null}
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={jest.fn()}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "追蹤 200" }));

    const renderedRows = document.querySelectorAll(".series-row");
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(subscribe.length);
  });

  it("renders dismiss update as a secondary action button", () => {
    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        update={[
          createFeedEntry({
            category: "update",
            key: "update_1",
            title: "One Piece",
            updateChapterTitle: "Ch 1124",
            lastReadTitle: "Ch 1123",
          }),
        ]}
        subscribe={[]}
        history={[]}
        continueReading={null}
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={jest.fn()}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "更新 1" }));

    expect(
      screen.getByRole("button", { name: "略過" }),
    ).toHaveClass("ds-btn-secondary");
  });
});
