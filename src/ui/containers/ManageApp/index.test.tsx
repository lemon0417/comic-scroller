import type { PopupFeedEntry } from "@domain/library";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import * as buildMode from "@utils/buildMode";
import type { ComponentType } from "react";

jest.mock("react-redux", () => ({
  connect: () => (Component: unknown) => Component,
}));

jest.mock("@utils/buildMode", () => ({
  __esModule: true,
  IS_DEVELOPMENT_BUILD: false,
}));
jest.mock("./ManageDeveloperPanel", () => ({
  __esModule: true,
  default: () => <div>測試開發者面板</div>,
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

  function renderEmptyManage(extra = {}) {
    return render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        update={[]}
        subscribe={[]}
        history={[]}
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestCleanupUnsubscribedSeries={jest.fn()}
        requestRemoveCard={jest.fn()}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
        {...extra}
      />,
    );
  }

  it("excludes developer controls and normalizes developer URLs in production", () => {
    window.history.replaceState({}, "", "/manage.html?tab=developer");
    renderEmptyManage();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "追蹤 0" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(window.location.search).toBe("?tab=following");
    fireEvent.click(screen.getByRole("tab", { name: "選項" }));
    expect(screen.queryByText("開發者功能")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: /除錯/ }),
    ).not.toBeInTheDocument();
  });

  it("offers the developer tab and deep link only in development", () => {
    jest.replaceProperty(buildMode, "IS_DEVELOPMENT_BUILD", true);
    window.history.replaceState({}, "", "/manage.html?tab=developer");
    renderEmptyManage();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: "開發者" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("測試開發者面板")).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "選項" }));
    expect(screen.queryByText("測試開發者面板")).not.toBeInTheDocument();
  });

  it("disables data changes when a developer background check is running", () => {
    jest.replaceProperty(buildMode, "IS_DEVELOPMENT_BUILD", true);
    window.history.replaceState({}, "", "/manage.html?tab=data");
    renderEmptyManage({ developerCheckRunning: true });
    for (const label of [
      "匯入設定",
      "匯出設定",
      "清理未追蹤作品",
      "重置資料",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
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
    expect(
      screen.getByRole("heading", { level: 1, name: "書庫" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("追蹤、閱讀紀錄與資料管理。"),
    ).not.toBeInTheDocument();
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

  it("toggles and runs Chrome library sync from the options tab", () => {
    const requestSetLibrarySyncEnabled = jest.fn();
    const requestSyncLibraryNow = jest.fn();

    render(
      <TestManageApp
        hydrationStatus="ready"
        activeAction={null}
        notice={null}
        exportUrl=""
        exportFilename=""
        librarySyncStatus={{
          enabled: true,
          available: true,
          lastSyncedAt: 1710000000000,
          remoteUpdatedAt: 1710000000000,
          payloadBytes: 4096,
          storageBytes: 2048,
          pendingPayloadBytes: 1953078,
          pendingStorageBytes: 100000,
          lastError: "同步資料 1953078 bytes 超過 Chrome Sync 安全配額 92160 bytes。",
          quotaBytes: 92160,
        }}
        update={[]}
        subscribe={[]}
        history={[]}
        continueReading={null}
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={jest.fn()}
        requestSetLibrarySyncEnabled={requestSetLibrarySyncEnabled}
        requestSyncLibraryNow={requestSyncLibraryNow}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "選項" }));
    expect(screen.getByRole("alert")).toHaveTextContent("1953078 bytes");
    expect(screen.getByText("上次成功的原始資料大小")).toBeInTheDocument();
    expect(screen.getByText("上次成功的同步儲存大小")).toBeInTheDocument();
    expect(screen.getByText("2 KiB（2,048 bytes）")).toBeInTheDocument();
    expect(screen.getByText("4 KiB（4,096 bytes）")).toBeInTheDocument();
    expect(screen.getByText("本次失敗的原始資料大小")).toBeInTheDocument();
    expect(screen.getByText("本次失敗的同步儲存大小")).toBeInTheDocument();
    expect(screen.getByText("98 KiB（100,000 bytes）")).toBeInTheDocument();
    expect(screen.getByText("1908 KiB（1,953,078 bytes）")).toBeInTheDocument();
    expect(screen.getByText("90 KiB（92,160 bytes）")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "同步精簡書庫" }));
    fireEvent.click(screen.getByRole("button", { name: "立即同步" }));

    expect(requestSetLibrarySyncEnabled).toHaveBeenCalledWith(false);
    expect(requestSyncLibraryNow).toHaveBeenCalled();
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

  it("confirms batch cleanup only after displaying its scope", () => {
    const props = {
      hydrationStatus: "ready",
      activeAction: null,
      notice: null,
      exportUrl: "",
      exportFilename: "",
      update: [],
      subscribe: [],
      history: [],
      continueReading: null,
      requestPopupData: jest.fn(),
      requestExportConfig: jest.fn(),
      requestImportConfig: jest.fn(),
      requestResetConfig: jest.fn(),
      requestRemoveCard: jest.fn(),
      clearExportConfig: jest.fn(),
      clearPopupNotice: jest.fn(),
      requestCleanupUnsubscribedSeries: jest.fn(),
    };
    const { rerender } = render(<TestManageApp {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "選項" }));
    fireEvent.click(screen.getByRole("button", { name: "清理未追蹤作品" }));
    let dialog = screen.getByRole("dialog", { name: "清理未追蹤作品" });
    expect(dialog).toHaveTextContent("從未追蹤");
    expect(dialog).toHaveTextContent("已追蹤作品會保留");
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(props.requestCleanupUnsubscribedSeries).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "清理未追蹤作品" }));
    dialog = screen.getByRole("dialog", { name: "清理未追蹤作品" });
    fireEvent.click(within(dialog).getByRole("button", { name: "確認清理" }));
    expect(props.requestCleanupUnsubscribedSeries).toHaveBeenCalledTimes(1);
    rerender(<TestManageApp {...props} activeAction="cleanup" />);
    expect(
      screen.getByRole("button", { name: "清理未追蹤作品" }),
    ).toBeDisabled();
  });

  it("opens an abandon modal with full cleanup checked by default", () => {
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
    const dialog = screen.getByRole("dialog", { name: "取消追蹤作品" });

    expect(dialog).toBeInTheDocument();
    expect(
      within(dialog).getByRole("checkbox", {
        name: "一併清除閱讀紀錄與作品資料",
      }),
    ).toBeChecked();

    fireEvent.click(
      within(dialog).getByRole("button", { name: "確認取消追蹤" }),
    );

    expect(requestRemoveCard).toHaveBeenCalledWith({
      category: "subscribe",
      index: 0,
      comicsID: "123",
      site: "dm5",
      clearSeriesData: true,
    });
  });

  it("can preserve history and resets full cleanup when reopened", () => {
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
    let dialog = screen.getByRole("dialog", { name: "取消追蹤作品" });
    fireEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "一併清除閱讀紀錄與作品資料",
      }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(requestRemoveCard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "棄坑" }));
    dialog = screen.getByRole("dialog", { name: "取消追蹤作品" });
    expect(within(dialog).getByRole("checkbox")).toBeChecked();
    fireEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "一併清除閱讀紀錄與作品資料",
      }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "確認取消追蹤" }),
    );

    expect(requestRemoveCard).toHaveBeenCalledWith({
      category: "subscribe",
      index: 0,
      comicsID: "123",
      clearSeriesData: false,
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

  it("filters visible rows by title or comics ID", async () => {
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
            comicsID: "op-001",
          }),
          createFeedEntry({
            key: "history_2",
            index: 1,
            title: "Naruto",
            comicsID: "nrt-002",
          }),
        ]}
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

    const search = screen.getByRole("searchbox", {
      name: "搜尋作品名或 ID",
    });

    fireEvent.change(search, { target: { value: "nrt" } });

    await waitFor(() => {
      expect(screen.getByText("Naruto")).toBeInTheDocument();
      expect(screen.queryByText("One Piece")).not.toBeInTheDocument();
      expect(screen.getByText("1 / 2")).toBeInTheDocument();
    });

    fireEvent.change(search, { target: { value: "op-001" } });

    await waitFor(() => {
      expect(screen.getByText("One Piece")).toBeInTheDocument();
      expect(screen.queryByText("Naruto")).not.toBeInTheDocument();
      expect(screen.getByText("1 / 2")).toBeInTheDocument();
    });
  });

  it("shows a search-specific empty state when no rows match", async () => {
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
            comicsID: "op-001",
          }),
        ]}
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

    fireEvent.change(
      screen.getByRole("searchbox", { name: "搜尋作品名或 ID" }),
      { target: { value: "missing" } },
    );

    await waitFor(() => {
      expect(screen.getByText("找不到符合的作品")).toBeInTheDocument();
      expect(screen.getByText("0 / 1")).toBeInTheDocument();
    });
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

    expect(screen.getByRole("button", { name: "略過" })).toHaveClass(
      "ds-btn-secondary",
    );
  });
});
