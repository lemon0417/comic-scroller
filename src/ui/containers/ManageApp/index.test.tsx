import { fireEvent, render, screen } from "@testing-library/react";
import type { PopupFeedEntry } from "@infra/services/library/models";
import { ManageApp } from "./index";

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

describe("ManageApp", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/manage.html?tab=history");
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
  });

  it("confirms and forgets a history entry", () => {
    const requestRemoveCard = jest.fn();
    jest.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ManageApp
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
        requestPopupData={jest.fn()}
        requestExportConfig={jest.fn()}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={requestRemoveCard}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Forget series" }));

    expect(requestRemoveCard).toHaveBeenCalledWith({
      category: "history",
      index: 0,
      comicsID: "123",
      site: "dm5",
    });
  });

  it("runs export from the data tab", () => {
    const requestExportConfig = jest.fn();

    render(
      <ManageApp
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
        requestExportConfig={requestExportConfig}
        requestImportConfig={jest.fn()}
        requestResetConfig={jest.fn()}
        requestRemoveCard={jest.fn()}
        clearExportConfig={jest.fn()}
        clearPopupNotice={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Data" }));
    fireEvent.click(screen.getByRole("button", { name: "Export config" }));

    expect(requestExportConfig).toHaveBeenCalled();
  });

  it("opens continue in the extension reader page", () => {
    render(
      <ManageApp
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

    fireEvent.click(screen.getByRole("tab", { name: "Following 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test/app.html?site=dm5&chapter=m1123",
    });
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
      <ManageApp
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

    fireEvent.click(screen.getByRole("tab", { name: "Following 200" }));

    const renderedRows = document.querySelectorAll(".ds-series-row");
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(subscribe.length);
  });

  it("renders dismiss update as a secondary action button", () => {
    render(
      <ManageApp
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

    fireEvent.click(screen.getByRole("tab", { name: "Updates 1" }));

    expect(
      screen.getByRole("button", { name: "Dismiss update" }),
    ).toHaveClass("ds-btn-secondary");
  });
});
