import Content from "@components/Content";
import NoticeBanner from "@components/NoticeBanner";
import ReleaseNoticeBanner from "@components/ReleaseNoticeBanner";
import Tabs from "@components/Tabs";
import {
  requestCleanupUnsubscribedSeries,
  requestDismissExtensionReleaseNotice,
  requestExportConfig,
  requestImportConfig,
  requestPopupData,
  requestRemoveCard,
  requestResetConfig,
  requestSetLibrarySyncEnabled,
  requestSyncLibraryNow,
} from "@domain/actions/popup";
import {
  createEmptyLibrarySyncStatus,
  type PopupFeedEntry,
} from "@domain/library";
import {
  clearExportConfig,
  clearPopupNotice,
} from "@domain/reducers/popupState";
import {
  type PopupViewProps,
  selectPopupView,
} from "@domain/selectors/popupView";
import { isDevLogEnabled, setDevLogEnabled } from "@utils/devLog";
import type { ChangeEventHandler } from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { connect } from "react-redux";

import { ManageConfirmDialog } from "./ManageConfirmDialog";
import { ManageDataPanel } from "./ManageDataPanel";
import { ManageFeedList } from "./ManageFeedList";
import { matchesManageSearchQuery, normalizeManageSearchQuery } from "./search";
import {
  getInitialTab,
  getRowsForManageTab,
  MANAGE_TAB_CONFIG,
  renderTabLabel,
  TAB_OPTIONS,
} from "./tabs";
import type { ManageDialogState, ManageFeedTab, ManageTab } from "./types";

type ManageAppProps = PopupViewProps & {
  requestCleanupUnsubscribedSeries: typeof requestCleanupUnsubscribedSeries;
  clearExportConfig: typeof clearExportConfig;
  clearPopupNotice: typeof clearPopupNotice;
  requestDismissExtensionReleaseNotice: typeof requestDismissExtensionReleaseNotice;
  requestExportConfig: typeof requestExportConfig;
  requestImportConfig: typeof requestImportConfig;
  requestPopupData: typeof requestPopupData;
  requestRemoveCard: typeof requestRemoveCard;
  requestResetConfig: typeof requestResetConfig;
  requestSetLibrarySyncEnabled: typeof requestSetLibrarySyncEnabled;
  requestSyncLibraryNow: typeof requestSyncLibraryNow;
};

function ManageAppComponent(props: ManageAppProps) {
  const {
    hydrationStatus,
    activeAction,
    notice,
    extensionReleaseNotice,
    exportUrl,
    exportFilename,
    librarySyncStatus = createEmptyLibrarySyncStatus(),
    update,
    subscribe,
    history,
    requestDismissExtensionReleaseNotice:
      requestDismissExtensionReleaseNoticeProp,
    requestPopupData: requestPopupDataProp,
    requestExportConfig: requestExportConfigProp,
    requestImportConfig: requestImportConfigProp,
    requestResetConfig: requestResetConfigProp,
    requestCleanupUnsubscribedSeries: requestCleanupUnsubscribedSeriesProp,
    requestSetLibrarySyncEnabled: requestSetLibrarySyncEnabledProp = () =>
      undefined,
    requestSyncLibraryNow: requestSyncLibraryNowProp = () => undefined,
    requestRemoveCard: requestRemoveCardProp,
    clearExportConfig: clearExportConfigProp,
    clearPopupNotice: clearPopupNoticeProp,
  } = props;

  const [selectedTab, setSelectedTab] = useState<ManageTab>(getInitialTab);
  const [debugLogEnabled, setDebugLogEnabled] = useState(isDevLogEnabled);
  const [dialogState, setDialogState] = useState<ManageDialogState>({
    kind: "closed",
  });
  const [localError, setLocalError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = useMemo(
    () => normalizeManageSearchQuery(deferredSearchQuery),
    [deferredSearchQuery],
  );
  const downloadRef = useRef<HTMLAnchorElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    requestPopupDataProp("manage");
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
  const isDataTab = selectedTab === "data";
  const tabCounts: Partial<Record<ManageTab, number>> = {
    updates: update.length,
    following: subscribe.length,
    history: history.length,
  };

  const currentRows = useMemo(
    () =>
      getRowsForManageTab(selectedTab, {
        updates: update,
        following: subscribe,
        history,
      }),
    [history, selectedTab, subscribe, update],
  );

  const filteredRows = useMemo(() => {
    if (!normalizedSearchQuery) {
      return currentRows;
    }
    return currentRows.filter((item) =>
      matchesManageSearchQuery(item, normalizedSearchQuery),
    );
  }, [currentRows, normalizedSearchQuery]);

  const isSearching = normalizedSearchQuery.length > 0;

  const handleSearchQueryChange: ChangeEventHandler<HTMLInputElement> =
    useCallback((event) => {
      setSearchQuery(event.currentTarget.value);
    }, []);

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.currentTarget.files?.item(0);
    if (!file) return;
    const input = event.currentTarget;

    void file
      .arrayBuffer()
      .then((raw) => {
        setLocalError("");
        clearPopupNoticeProp();
        requestImportConfigProp(raw);
      })
      .catch(() => {
        setLocalError("目前無法讀取設定檔。");
      })
      .finally(() => {
        input.value = "";
      });
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

  const closeDialog = useCallback(() => {
    if (busy) {
      return;
    }
    setDialogState({ kind: "closed" });
  }, [busy]);

  const openResetDialog = useCallback(() => {
    setDialogState({ kind: "reset" });
  }, []);

  const openHistoryRemovalDialog = useCallback((item: PopupFeedEntry) => {
    setDialogState({
      kind: "history",
      item,
    });
  }, []);

  const openAbandonSeriesDialog = useCallback((item: PopupFeedEntry) => {
    setDialogState({
      kind: "subscribe",
      item,
      clearSeriesData: true,
    });
  }, []);

  const handleSubscribeClearSeriesDataChange = useCallback(
    (checked: boolean) => {
      setDialogState((currentState) =>
        currentState.kind === "subscribe"
          ? {
              ...currentState,
              clearSeriesData: checked,
            }
          : currentState,
      );
    },
    [],
  );

  const handleDialogConfirm = useCallback(() => {
    if (busy || dialogState.kind === "closed") {
      return;
    }

    setLocalError("");
    clearPopupNoticeProp();

    if (dialogState.kind === "cleanup") {
      requestCleanupUnsubscribedSeriesProp();
      setDialogState({ kind: "closed" });
      return;
    }

    if (dialogState.kind === "reset") {
      requestResetConfigProp();
      setDialogState({ kind: "closed" });
      return;
    }

    if (dialogState.kind === "history") {
      requestRemoveCardProp({
        category: "history",
        index: dialogState.item.index,
        comicsID: dialogState.item.comicsID,
        site: dialogState.item.site,
      });
      setDialogState({ kind: "closed" });
      return;
    }

    requestRemoveCardProp({
      category: "subscribe",
      index: dialogState.item.index,
      comicsID: dialogState.item.comicsID,
      site: dialogState.item.site,
      clearSeriesData: dialogState.clearSeriesData,
    });
    setDialogState({ kind: "closed" });
  }, [
    busy,
    clearPopupNoticeProp,
    dialogState,
    requestRemoveCardProp,
    requestResetConfigProp,
    requestCleanupUnsubscribedSeriesProp,
  ]);

  const handleExportClick = useCallback(() => {
    setLocalError("");
    clearPopupNoticeProp();
    requestExportConfigProp();
  }, [clearPopupNoticeProp, requestExportConfigProp]);

  const handleSyncToggle = useCallback(
    (enabled: boolean) => {
      setLocalError("");
      clearPopupNoticeProp();
      requestSetLibrarySyncEnabledProp(enabled);
    },
    [clearPopupNoticeProp, requestSetLibrarySyncEnabledProp],
  );

  const handleSyncNow = useCallback(() => {
    setLocalError("");
    clearPopupNoticeProp();
    requestSyncLibraryNowProp();
  }, [clearPopupNoticeProp, requestSyncLibraryNowProp]);

  return (
    <div className="manage-shell">
      <header className="manage-topbar">
        <h1 className="manage-title">書庫</h1>
      </header>

      <Tabs
        value={selectedTab}
        onValueChange={(value) => setSelectedTab(value as ManageTab)}
      >
        <Tabs.List variant="manage" className="manage-tabbar">
          {TAB_OPTIONS.map((tab) => (
            <Tabs.Trigger
              key={tab}
              variant="manage"
              className="manage-tab"
              value={tab}
            >
              {renderTabLabel(MANAGE_TAB_CONFIG[tab].label, tabCounts[tab])}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>

      <Content
        variant="manage"
        className={`manage-content ${
          isDataTab ? "overflow-y-auto" : "overflow-hidden"
        }`}
      >
        {extensionReleaseNotice ? (
          <ReleaseNoticeBanner
            density="manage"
            notice={extensionReleaseNotice}
            onDismiss={requestDismissExtensionReleaseNoticeProp}
          />
        ) : null}
        {localError ? (
          <NoticeBanner
            message={localError}
            tone="error"
            onDismiss={() => setLocalError("")}
          />
        ) : null}
        {notice ? (
          <NoticeBanner
            message={notice.message}
            tone={notice.tone}
            onDismiss={clearPopupNoticeProp}
          />
        ) : null}

        {isDataTab ? (
          <ManageDataPanel
            busy={busy}
            debugLogEnabled={debugLogEnabled}
            librarySyncStatus={librarySyncStatus}
            onDebugLogToggle={handleDebugLogToggle}
            onExportClick={handleExportClick}
            onImportClick={() => fileInputRef.current?.click()}
            onResetClick={openResetDialog}
            onCleanupClick={() => setDialogState({ kind: "cleanup" })}
            onSyncNow={handleSyncNow}
            onSyncToggle={handleSyncToggle}
          />
        ) : (
          <div className="manage-list-layout">
            <div className="manage-search-row">
              <label className="manage-search-field">
                <span className="sr-only">搜尋作品名或 ID</span>
                <input
                  type="search"
                  className="manage-search-input"
                  placeholder="搜尋作品名或 ID"
                  value={searchQuery}
                  disabled={isLoading}
                  onChange={handleSearchQueryChange}
                />
              </label>
              <div className="manage-search-count" aria-live="polite">
                {isSearching
                  ? `${filteredRows.length} / ${currentRows.length}`
                  : `${currentRows.length} 筆`}
              </div>
            </div>
            <ManageFeedList
              busy={busy}
              currentRows={currentRows}
              filteredRows={filteredRows}
              isLoading={isLoading}
              isSearching={isSearching}
              searchKey={normalizedSearchQuery}
              selectedTab={selectedTab as ManageFeedTab}
              onRemoveCard={requestRemoveCardProp}
              onRequestAbandonSeries={openAbandonSeriesDialog}
              onRequestHistoryRemoval={openHistoryRemovalDialog}
            />
          </div>
        )}
      </Content>
      <a ref={downloadRef} className="hidden">
        匯出設定
      </a>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
      <ManageConfirmDialog
        busy={busy}
        dialogState={dialogState}
        onClearSeriesDataChange={handleSubscribeClearSeriesDataChange}
        onClose={closeDialog}
        onConfirm={handleDialogConfirm}
      />
    </div>
  );
}

export default connect(selectPopupView, {
  requestCleanupUnsubscribedSeries,
  clearExportConfig,
  clearPopupNotice,
  requestDismissExtensionReleaseNotice,
  requestExportConfig,
  requestImportConfig,
  requestPopupData,
  requestRemoveCard,
  requestResetConfig,
  requestSetLibrarySyncEnabled,
  requestSyncLibraryNow,
})(ManageAppComponent);
