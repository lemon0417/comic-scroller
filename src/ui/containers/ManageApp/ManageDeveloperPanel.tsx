import Button from "@components/Button";
import NoticeBanner from "@components/NoticeBanner";
import SwitchField from "@components/SwitchField";
import {
  requestBackgroundCheck,
  requestInitializeDeveloperTools,
  requestSetDevLogEnabled,
} from "@domain/actions/developerTools";
import { initialDeveloperToolsState } from "@domain/reducers/developerTools";
import type { PopupRootState } from "@epics/types";
import { IS_DEVELOPMENT_BUILD } from "@utils/buildMode";
import { useEffect } from "react";
import { connect } from "react-redux";

function selectDeveloperTools(state: PopupRootState) {
  return { developerTools: state.developerTools || initialDeveloperToolsState };
}

type Props = ReturnType<typeof selectDeveloperTools> & {
  busy: boolean;
  requestBackgroundCheck: typeof requestBackgroundCheck;
  requestInitializeDeveloperTools: typeof requestInitializeDeveloperTools;
  requestSetDevLogEnabled: typeof requestSetDevLogEnabled;
};

function ManageDeveloperPanel({
  busy,
  developerTools,
  requestBackgroundCheck: requestCheck,
  requestInitializeDeveloperTools: initialize,
  requestSetDevLogEnabled: setDebugLog,
}: Props) {
  const {
    debugLogEnabled,
    debugPending,
    debugReady,
    debugError,
    checkStatus,
    checkResult,
    checkError,
  } = developerTools;
  const checking = checkStatus === "running";

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="manage-settings-stack">
      <section className="manage-settings-section">
        <h2 className="manage-section-title">除錯記錄</h2>
        <SwitchField
          id="manage-debug-log-toggle"
          label="輸出除錯記錄"
          description="輸出 Redux action 與解析 trace 到 console。"
          checked={debugLogEnabled}
          disabled={!debugReady || debugPending}
          onToggle={() => setDebugLog(!debugLogEnabled)}
        />
        {debugError ? <NoticeBanner message={debugError} tone="error" /> : null}
      </section>
      <section className="manage-settings-section">
        <h2 className="manage-section-title">背景檢查</h2>
        <p className="manage-section-desc">
          檢查已追蹤作品的新章節，會更新書庫的更新提醒與工具列提示數量。
        </p>
        <div className="manage-settings-actions">
          <Button
            variant="secondary"
            disabled={busy || checking}
            onClick={requestCheck}
          >
            {checking ? "背景檢查中…" : "執行背景檢查"}
          </Button>
        </div>
        {checking ? (
          <p role="status" className="manage-sync-message">
            正在檢查已追蹤作品，請稍候。
          </p>
        ) : null}
        {checkError ? <NoticeBanner message={checkError} tone="error" /> : null}
        {checkResult ? (
          <div role="status" aria-live="polite">
            <p className="manage-sync-message">
              {checkResult.summary.errors
                ? "背景檢查完成，部分作品檢查失敗。"
                : "背景檢查完成。"}
            </p>
            <dl className="manage-sync-details">
              <dt>完成時間</dt>
              <dd>
                {new Date(checkResult.at).toLocaleString("zh-TW", {
                  hour12: false,
                })}
              </dd>
              <dt>檢查作品</dt>
              <dd>{checkResult.summary.checked} 部</dd>
              <dt>有更新作品</dt>
              <dd>{checkResult.summary.updated} 部</dd>
              <dt>新增提醒</dt>
              <dd>{checkResult.summary.diff.added} 筆</dd>
              <dt>檢查錯誤</dt>
              <dd>{checkResult.summary.errors} 筆</dd>
            </dl>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default IS_DEVELOPMENT_BUILD
  ? connect(selectDeveloperTools, {
      requestBackgroundCheck,
      requestInitializeDeveloperTools,
      requestSetDevLogEnabled,
    })(ManageDeveloperPanel)
  : (_props: { busy: boolean }) => null;
