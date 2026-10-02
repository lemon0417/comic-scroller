import Button from "@components/Button";
import SwitchField from "@components/SwitchField";
import type { LibrarySyncStatus } from "@domain/library";

type ManageDataPanelProps = {
  busy: boolean;
  debugLogEnabled: boolean;
  librarySyncStatus: LibrarySyncStatus;
  onDebugLogToggle: () => void;
  onExportClick: () => void;
  onImportClick: () => void;
  onResetClick: () => void;
  onCleanupClick: () => void;
  onSyncNow: () => void;
  onSyncToggle: (enabled: boolean) => void;
};

function formatSyncTime(timestamp?: number) {
  if (!timestamp) {
    return "尚未同步";
  }
  return new Date(timestamp).toLocaleString("zh-TW", {
    hour12: false,
  });
}

function formatPayloadSize(bytes?: number) {
  if (!bytes) {
    return "無遠端資料";
  }
  return `${Math.ceil(bytes / 1024)} KB`;
}

export function ManageDataPanel({
  busy,
  debugLogEnabled,
  librarySyncStatus,
  onDebugLogToggle,
  onExportClick,
  onImportClick,
  onResetClick,
  onCleanupClick,
  onSyncNow,
  onSyncToggle,
}: ManageDataPanelProps) {
  const syncDisabled = busy || !librarySyncStatus.available;

  return (
    <div className="manage-settings-stack">
      <section className="manage-settings-section">
        <h2 className="manage-section-title">Chrome 同步</h2>
        <SwitchField
          id="manage-library-sync-toggle"
          label="同步精簡書庫"
          description="使用 Chrome 帳號同步追蹤、閱讀紀錄與更新狀態；完整章節快取仍只保留在本機。"
          checked={librarySyncStatus.enabled}
          disabled={syncDisabled}
          onToggle={() => onSyncToggle(!librarySyncStatus.enabled)}
        />
        <dl className="manage-sync-details">
          <dt>上次同步</dt>
          <dd>{formatSyncTime(librarySyncStatus.lastSyncedAt)}</dd>
          <dt>遠端更新</dt>
          <dd>{formatSyncTime(librarySyncStatus.remoteUpdatedAt)}</dd>
          <dt>同步大小</dt>
          <dd>{formatPayloadSize(librarySyncStatus.payloadBytes)}</dd>
        </dl>
        {librarySyncStatus.lastError ? (
          <p
            role="alert"
            className="manage-sync-message text-comic-danger-text"
          >
            {librarySyncStatus.lastError}
          </p>
        ) : null}
        {!librarySyncStatus.available ? (
          <p role="status" className="manage-sync-message">
            目前無法存取 Chrome Sync，請確認 extension storage
            權限與瀏覽器環境。
          </p>
        ) : null}
        <div className="manage-settings-actions">
          <Button
            variant="secondary"
            disabled={syncDisabled || !librarySyncStatus.enabled}
            onClick={onSyncNow}
          >
            立即同步
          </Button>
        </div>
      </section>
      <section className="manage-settings-section">
        <h2 className="manage-section-title">資料</h2>
        <p className="manage-section-desc">匯入或匯出書庫資料。</p>
        <div className="manage-settings-actions">
          <Button variant="primary" disabled={busy} onClick={onImportClick}>
            匯入設定
          </Button>
          <Button variant="secondary" disabled={busy} onClick={onExportClick}>
            匯出設定
          </Button>
        </div>
        <p className="manage-section-desc">
          清除未追蹤作品的閱讀紀錄、更新提醒與快取；已追蹤作品會保留。
        </p>
        <div className="manage-settings-actions">
          <Button variant="danger" disabled={busy} onClick={onCleanupClick}>
            清理未追蹤作品
          </Button>
        </div>
      </section>
      <section className="manage-settings-section">
        <h2 className="manage-section-title">開發者功能</h2>
        <SwitchField
          id="manage-debug-log-toggle"
          label="除錯記錄"
          description="輸出 Redux action 與解析 trace 到 console。"
          checked={debugLogEnabled}
          onToggle={onDebugLogToggle}
        />
      </section>
      <section className="manage-settings-section">
        <h2 className="manage-section-title">重置資料</h2>
        <p className="manage-section-desc">
          刪除更新、追蹤、閱讀紀錄與作品快取。
        </p>
        <div className="manage-settings-actions">
          <Button variant="danger" disabled={busy} onClick={onResetClick}>
            重置資料
          </Button>
        </div>
      </section>
    </div>
  );
}
