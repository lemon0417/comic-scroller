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

function renderTabLabel(label: string, count?: number) {
  return (
    <span className="manage-tab-label">
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className="manage-tab-count">{count}</span>
      ) : null}
    </span>
  );
}

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
          variant="manage"
          title={item.title}
          titleHref={item.url}
          siteLabel={item.siteLabel}
          cover={item.cover}
          summary={`新章節：${item.updateChapterTitle || item.lastChapterTitle}`}
          detail={`上次閱讀：${item.lastReadTitle}`}
          actions={[
            {
              icon: "arrow",
              label: "閱讀",
              variant: "primary",
              onClick: () =>
                openReaderPage(
                  item.site,
                  item.updateChapterID || item.lastChapterID,
                  item.updateChapterHref || item.lastChapterHref || item.url,
                ),
            },
            {
              icon: "trash",
              label: "略過",
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
          variant="manage"
          title={item.title}
          titleHref={item.url}
          siteLabel={item.siteLabel}
          cover={item.cover}
          summary={`上次閱讀：${item.lastReadTitle}`}
          detail={`最新章節：${item.lastChapterTitle}`}
          actions={[
            {
              icon: "arrow",
              label: "繼續",
              variant: "primary",
              onClick: () =>
                openReaderPage(
                  item.site,
                  item.continueChapterID,
                  item.continueHref,
                ),
            },
            {
              icon: "tag",
              label: "棄坑",
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
        variant="manage"
        title={item.title}
        titleHref={item.url}
        siteLabel={item.siteLabel}
        cover={item.cover}
        summary={`上次閱讀：${item.lastReadTitle}`}
        detail={`最新章節：${item.lastChapterTitle}`}
        actions={[
          {
            icon: "arrow",
            label: "繼續",
            variant: "primary",
            onClick: () =>
              openReaderPage(item.site, item.continueChapterID, item.continueHref),
          },
          {
            icon: "trash",
            label: "移除",
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
        setLocalError("設定檔格式錯誤，請上傳有效 JSON。");
      } finally {
        event.currentTarget.value = "";
      }
    };

    reader.readAsText(file);
  };

  const handleReset = () => {
    const shouldReset = window.confirm(
      "確定重置所有資料？此操作會刪除更新、追蹤、紀錄與作品快取。",
    );
    if (!shouldReset) return;
    setLocalError("");
    clearPopupNoticeProp();
    requestResetConfigProp();
  };

  const handleDebugLogToggle = () => {
    const enabled = !debugLogEnabled;
    if (!setDevLogEnabled(enabled)) {
      setLocalError("目前無法切換除錯記錄。");
      return;
    }
    setLocalError("");
    setDebugLogEnabled(enabled);
  };

  const handleForgetSeries = useCallback(
    (item: PopupFeedEntry) => {
      const shouldForget = window.confirm(
        `確定移除「${item.title}」？此操作會刪除紀錄、更新、追蹤與作品快取。`,
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

  const renderRows = () => {
    if (isLoading) {
      return <LoadingRows count={4} />;
    }

    if (selectedTab === "updates" && currentRows.length === 0) {
      return (
        <EmptyState
          title="目前沒有更新"
          description="已追蹤作品目前沒有新章節。"
        />
      );
    }

    if (selectedTab === "following" && currentRows.length === 0) {
      return (
        <EmptyState
          title="尚未追蹤作品"
          description="在閱讀頁追蹤作品後會顯示於此。"
        />
      );
    }

    if (selectedTab === "history" && currentRows.length === 0) {
      return (
        <EmptyState
          title="尚無閱讀紀錄"
          description="開始閱讀後會顯示於此。"
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
          height: "100%",
          width: "100%",
        }}
      />
    );
  };

  return (
    <div className="manage-shell">
      <div className="manage-window">
        <div className="manage-topbar">
          <div className="min-w-0 flex-1">
            <div className="manage-title">書庫</div>
            <p className="manage-subtitle">
              追蹤、閱讀紀錄與資料管理。
            </p>
          </div>
        </div>

        <Tabs
          value={selectedTab}
          onValueChange={(value) => setSelectedTab(value as ManageTab)}
        >
          <Tabs.List className="manage-tabbar">
            <Tabs.Trigger className="manage-tab" value="updates">
              {renderTabLabel("更新", update.length)}
            </Tabs.Trigger>
            <Tabs.Trigger className="manage-tab" value="following">
              {renderTabLabel("追蹤", subscribe.length)}
            </Tabs.Trigger>
            <Tabs.Trigger className="manage-tab" value="history">
              {renderTabLabel("紀錄", history.length)}
            </Tabs.Trigger>
            <Tabs.Trigger className="manage-tab" value="data">
              {renderTabLabel("選項")}
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs>

        <Content
          className={`manage-content ${
            selectedTab === "data" ? "overflow-y-auto" : "overflow-hidden"
          }`}
        >
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
              <div className="manage-settings-stack">
                <section className="manage-settings-section">
                  <h2 className="manage-section-title">開發者功能</h2>
                  <div className="manage-setting-row">
                    <span className="flex min-w-0 flex-col gap-1">
                      <span
                        id="manage-debug-log-label"
                        className="text-[14px] font-medium text-comic-ink"
                      >
                        除錯記錄
                      </span>
                      <span
                        id="manage-debug-log-desc"
                        className="text-[12px] leading-5 text-comic-ink/60"
                      >
                        輸出 Redux action 與解析 trace 到 console。
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
                <section className="manage-settings-section">
                  <h2 className="manage-section-title">資料</h2>
                  <p className="manage-section-desc">
                    匯入、匯出或重置資料。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="ds-btn-primary"
                      disabled={busy}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      匯入設定
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
                      匯出設定
                    </button>
                    <button
                      type="button"
                      className="ds-btn-danger"
                      disabled={busy}
                      onClick={handleReset}
                    >
                      重置資料
                    </button>
                  </div>
                </section>
              </div>
            ) : (
              renderRows()
            )}
        </Content>
      </div>
      <a ref={downloadRef} className="hidden">
        匯出設定
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
