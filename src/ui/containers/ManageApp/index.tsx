import type { ChangeEventHandler } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connect } from "react-redux";
import {
  List,
  type RowComponentProps,
  useDynamicRowHeight,
} from "react-window";
import Content from "@components/Content";
import EmptyState from "@components/EmptyState";
import LoadingRows from "@components/LoadingRows";
import NoticeBanner from "@components/NoticeBanner";
import Panel from "@components/Panel";
import SeriesRow from "@components/SeriesRow";
import Tabs from "@components/Tabs";
import {
  clearExportConfig,
  clearPopupNotice,
} from "@domain/reducers/popupState";
import {
  requestExportConfig,
  requestImportConfig,
  requestPopupData,
  requestRemoveCard,
  requestResetConfig,
} from "@domain/actions/popup";
import {
  type PopupViewProps,
  selectPopupView,
} from "@domain/selectors/popupView";
import type { PopupFeedEntry } from "@infra/services/library/models";
import { isDevLogEnabled, setDevLogEnabled } from "@utils/devLog";

type ManageTab = "updates" | "following" | "history" | "data";

type ManageRowsListProps = {
  selectedTab: Exclude<ManageTab, "data">;
  rows: PopupFeedEntry[];
  onForgetSeries: (item: PopupFeedEntry) => void;
  onRemoveCard: typeof requestRemoveCard;
};

const MANAGE_ROW_DEFAULT_HEIGHT = 112;
const MANAGE_LIST_MAX_HEIGHT = 720;
const MANAGE_LIST_OVERSCAN_COUNT = 6;

type ManageAppProps = PopupViewProps & {
  clearExportConfig: typeof clearExportConfig;
  clearPopupNotice: typeof clearPopupNotice;
  requestExportConfig: typeof requestExportConfig;
  requestImportConfig: typeof requestImportConfig;
  requestPopupData: typeof requestPopupData;
  requestRemoveCard: typeof requestRemoveCard;
  requestResetConfig: typeof requestResetConfig;
};

const TAB_OPTIONS: ManageTab[] = ["updates", "following", "history", "data"];

function getInitialTab(): ManageTab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return TAB_OPTIONS.includes(tab as ManageTab)
    ? (tab as ManageTab)
    : "following";
}

function openUrl(url: string) {
  if (!url) return;
  chrome.tabs.create({ url });
}

function openReaderPage(site: string, chapterID?: string, fallbackUrl = "") {
  if (site && chapterID) {
    const params = new URLSearchParams({ site, chapter: chapterID });
    chrome.tabs.create({
      url: `${chrome.runtime.getURL("app.html")}?${params.toString()}`,
    });
    return;
  }
  openUrl(fallbackUrl);
}

function ManageFeedRow({
  ariaAttributes,
  index,
  onForgetSeries,
  onRemoveCard,
  rows,
  selectedTab,
  style,
}: RowComponentProps<ManageRowsListProps>) {
  const item = rows[index];
  if (!item) {
    return null;
  }

  if (selectedTab === "updates") {
    return (
      <div {...ariaAttributes} style={style} className="px-1 py-1.5">
        <SeriesRow
          title={item.title}
          siteLabel={item.siteLabel}
          cover={item.cover}
          summary={`New chapter • ${item.updateChapterTitle || item.lastChapterTitle}`}
          detail={`Last read • ${item.lastReadTitle}`}
          actions={[
            {
              label: "Read update",
              variant: "primary",
              onClick: () =>
                openReaderPage(
                  item.site,
                  item.updateChapterID || item.lastChapterID,
                  item.updateChapterHref || item.lastChapterHref || item.url,
                ),
            },
            {
              label: "Dismiss update",
              onClick: () =>
                onRemoveCard({
                  category: "update",
                  index: item.index,
                  comicsID: item.comicsID,
                  chapterID: item.chapterID,
                  site: item.site,
                }),
            },
          ]}
        />
      </div>
    );
  }

  if (selectedTab === "following") {
    return (
      <div {...ariaAttributes} style={style} className="px-1 py-1.5">
        <SeriesRow
          title={item.title}
          siteLabel={item.siteLabel}
          cover={item.cover}
          summary={`Last read • ${item.lastReadTitle}`}
          detail={`Latest • ${item.lastChapterTitle}`}
          actions={[
            {
              label: "Continue",
              variant: "primary",
              onClick: () =>
                openReaderPage(
                  item.site,
                  item.continueChapterID,
                  item.continueHref,
                ),
            },
            {
              label: "Unfollow",
              variant: "danger",
              onClick: () =>
                onRemoveCard({
                  category: "subscribe",
                  index: item.index,
                  comicsID: item.comicsID,
                  site: item.site,
                }),
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div {...ariaAttributes} style={style} className="px-1 py-1.5">
      <SeriesRow
        title={item.title}
        siteLabel={item.siteLabel}
        cover={item.cover}
        summary={`Last read • ${item.lastReadTitle}`}
        detail={`Latest • ${item.lastChapterTitle}`}
        actions={[
          {
            label: "Continue",
            variant: "primary",
            onClick: () =>
              openReaderPage(item.site, item.continueChapterID, item.continueHref),
          },
          {
            label: "Forget series",
            variant: "danger",
            onClick: () => onForgetSeries(item),
          },
        ]}
      />
    </div>
  );
}

function ManageAppComponent(props: ManageAppProps) {
  const {
    hydrationStatus,
    activeAction,
    notice,
    exportUrl,
    exportFilename,
    update,
    subscribe,
    history,
    requestPopupData: requestPopupDataProp,
    requestExportConfig: requestExportConfigProp,
    requestImportConfig: requestImportConfigProp,
    requestResetConfig: requestResetConfigProp,
    requestRemoveCard: requestRemoveCardProp,
    clearExportConfig: clearExportConfigProp,
    clearPopupNotice: clearPopupNoticeProp,
  } = props;

  const [selectedTab, setSelectedTab] = useState<ManageTab>(getInitialTab);
  const [debugLogEnabled, setDebugLogEnabled] = useState(isDevLogEnabled);
  const [localError, setLocalError] = useState("");
  const rowHeights = useDynamicRowHeight({
    defaultRowHeight: MANAGE_ROW_DEFAULT_HEIGHT,
    key: selectedTab,
  });
  const downloadRef = useRef<HTMLAnchorElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    requestPopupDataProp();
  }, [requestPopupDataProp]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", selectedTab);
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", nextUrl);
  }, [selectedTab]);

  useEffect(() => {
    if (!exportUrl) return;
    const link = downloadRef.current;
    if (!link) return;
    link.href = exportUrl;
    link.download = exportFilename || "comic-scroller-config.json";
    link.click();
    window.URL.revokeObjectURL(exportUrl);
    clearExportConfigProp();
  }, [clearExportConfigProp, exportFilename, exportUrl]);

  const busy = activeAction !== null;
  const isLoading = hydrationStatus !== "ready";

  const currentRows = useMemo(() => {
    if (selectedTab === "updates") return update;
    if (selectedTab === "following") return subscribe;
    if (selectedTab === "history") return history;
    return [];
  }, [history, selectedTab, subscribe, update]);

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.currentTarget.files?.item(0);
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      const raw = loadEvent.target && (loadEvent.target as FileReader).result;
      try {
        const parsed = JSON.parse(String(raw || "{}"));
        setLocalError("");
        clearPopupNoticeProp();
        requestImportConfigProp(parsed);
      } catch {
        setLocalError("Invalid config file. Please upload valid JSON.");
      } finally {
        event.currentTarget.value = "";
      }
    };

    reader.readAsText(file);
  };

  const handleReset = () => {
    const shouldReset = window.confirm(
      "Reset all extension data? This removes updates, subscriptions, history, and saved series records.",
    );
    if (!shouldReset) return;
    setLocalError("");
    clearPopupNoticeProp();
    requestResetConfigProp();
  };

  const handleDebugLogToggle = () => {
    const enabled = !debugLogEnabled;
    if (!setDevLogEnabled(enabled)) {
      setLocalError("Debug logging is unavailable in this context.");
      return;
    }
    setLocalError("");
    setDebugLogEnabled(enabled);
  };

  const handleForgetSeries = useCallback(
    (item: PopupFeedEntry) => {
      const shouldForget = window.confirm(
        `Forget “${item.title}”? This removes its history, updates, subscription, and cached series data.`,
      );
      if (!shouldForget) return;
      requestRemoveCardProp({
        category: "history",
        index: item.index,
        comicsID: item.comicsID,
        site: item.site,
      });
    },
    [requestRemoveCardProp],
  );

  const rowProps = useMemo<ManageRowsListProps>(
    () => ({
      selectedTab:
        selectedTab === "data" ? "following" : selectedTab,
      rows: currentRows,
      onForgetSeries: handleForgetSeries,
      onRemoveCard: requestRemoveCardProp,
    }),
    [currentRows, handleForgetSeries, requestRemoveCardProp, selectedTab],
  );

  const listHeight = useMemo(
    () =>
      Math.min(
        MANAGE_LIST_MAX_HEIGHT,
        Math.max(
          MANAGE_ROW_DEFAULT_HEIGHT,
          currentRows.length * rowHeights.getAverageRowHeight(),
        ),
      ),
    [currentRows.length, rowHeights],
  );

  const renderRows = () => {
    if (isLoading) {
      return <LoadingRows count={4} />;
    }

    if (selectedTab === "updates" && currentRows.length === 0) {
      return (
        <EmptyState
          title="No pending updates"
          description="You are caught up across your followed series."
        />
      );
    }

    if (selectedTab === "following" && currentRows.length === 0) {
      return (
        <EmptyState
          title="No followed series"
          description="Follow a series from the reader to keep it in your library."
        />
      );
    }

    if (selectedTab === "history" && currentRows.length === 0) {
      return (
        <EmptyState
          title="No reading history"
          description="Start reading a chapter and it will appear here."
        />
      );
    }

    return (
      <List
        className="popup-scrollbar scrollbar-stable"
        overscanCount={MANAGE_LIST_OVERSCAN_COUNT}
        rowComponent={ManageFeedRow}
        rowCount={currentRows.length}
        rowHeight={rowHeights}
        rowProps={rowProps}
        style={{
          height: listHeight,
          width: "100%",
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-comic-paper2 px-6 py-8 text-comic-ink">
      <Panel className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-5xl overflow-hidden">
        <div className="border-b border-comic-ink/10 px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[24px] font-semibold tracking-[-0.02em] text-comic-ink">
                Library
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-comic-ink/60">
                Followed series, reading history, updates, and extension data
                in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="ds-count-badge">
                {subscribe.length} following
              </span>
              <span className="ds-count-badge">{update.length} updates</span>
            </div>
          </div>
          <div className="mt-6">
            <Tabs
              value={selectedTab}
              onValueChange={(value) => setSelectedTab(value as ManageTab)}
            >
              <Tabs.List className="max-w-[560px]">
                <Tabs.Trigger value="updates">{`Updates ${update.length}`}</Tabs.Trigger>
                <Tabs.Trigger value="following">{`Following ${subscribe.length}`}</Tabs.Trigger>
                <Tabs.Trigger value="history">{`History ${history.length}`}</Tabs.Trigger>
                <Tabs.Trigger value="data">Data</Tabs.Trigger>
              </Tabs.List>
            </Tabs>
          </div>
        </div>
        <Content className="px-6 py-6">
          {localError ? (
            <div className="mb-4">
              <NoticeBanner
                message={localError}
                tone="error"
                onDismiss={() => setLocalError("")}
              />
            </div>
          ) : null}
          {notice ? (
            <div className="mb-4">
              <NoticeBanner
                message={notice.message}
                tone={notice.tone}
                onDismiss={clearPopupNoticeProp}
              />
            </div>
          ) : null}

          {selectedTab === "data" ? (
            <div className="flex max-w-2xl flex-col gap-4">
              <section className="rounded-xl border border-comic-ink/10 bg-comic-paper p-6">
                <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-comic-ink">
                  Diagnostics
                </h2>
                <p className="mt-2 text-sm leading-6 text-comic-ink/60">
                  Toggle dev logs for reader, popup, and manage pages without
                  opening DevTools manually.
                </p>
                <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-comic-ink/10 bg-white px-4 py-3">
                  <span className="flex min-w-0 flex-col gap-1">
                    <span
                      id="manage-debug-log-label"
                      className="text-[14px] font-medium text-comic-ink"
                    >
                      Debug logging
                    </span>
                    <span
                      id="manage-debug-log-desc"
                      className="text-[12px] leading-5 text-comic-ink/60"
                    >
                      Writes Redux actions and parser traces to the console in
                      development builds.
                    </span>
                  </span>
                  <button
                    id="manage-debug-log-toggle"
                    type="button"
                    role="switch"
                    aria-checked={debugLogEnabled}
                    aria-labelledby="manage-debug-log-label"
                    aria-describedby="manage-debug-log-desc"
                    className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-comic-accent focus-visible:ring-offset-2 focus-visible:ring-offset-comic-paper ${
                      debugLogEnabled
                        ? "border-blue-600 bg-blue-600"
                        : "border-comic-ink/10 bg-comic-paper2"
                    }`}
                    onClick={handleDebugLogToggle}
                  >
                    <span
                      className={`absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform duration-150 ${
                        debugLogEnabled
                          ? "translate-x-[22px]"
                          : "translate-x-[2px]"
                      }`}
                    />
                  </button>
                </div>
              </section>
              <section className="rounded-xl border border-comic-ink/10 bg-comic-paper p-6">
                <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-comic-ink">
                  Data
                </h2>
                <p className="mt-2 text-sm leading-6 text-comic-ink/60">
                  Import or export your config, or reset everything back to the
                  extension defaults.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="ds-btn-primary"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Import config
                  </button>
                  <button
                    type="button"
                    className="ds-btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      setLocalError("");
                      clearPopupNoticeProp();
                      requestExportConfigProp();
                    }}
                  >
                    Export config
                  </button>
                  <button
                    type="button"
                    className="ds-btn-danger"
                    disabled={busy}
                    onClick={handleReset}
                  >
                    Reset all data
                  </button>
                </div>
              </section>
            </div>
          ) : (
            renderRows()
          )}
        </Content>
      </Panel>
      <a ref={downloadRef} className="hidden">
        Download Config
      </a>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

export { ManageAppComponent as ManageApp };

export default connect(selectPopupView, {
  clearExportConfig,
  clearPopupNotice,
  requestExportConfig,
  requestImportConfig,
  requestPopupData,
  requestRemoveCard,
  requestResetConfig,
})(ManageAppComponent);
