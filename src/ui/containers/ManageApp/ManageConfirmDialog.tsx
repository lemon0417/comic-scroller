import ConfirmDialog from "@components/ConfirmDialog";
import UnsubscribeSeriesDialog from "@components/UnsubscribeSeriesDialog";

import type { ManageDialogState } from "./types";

type ManageConfirmDialogProps = {
  busy: boolean;
  dialogState: ManageDialogState;
  onClearSeriesDataChange: (checked: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function ManageConfirmDialog({
  busy,
  dialogState,
  onClearSeriesDataChange,
  onClose,
  onConfirm,
}: ManageConfirmDialogProps) {
  if (dialogState.kind === "closed") {
    return null;
  }

  if (dialogState.kind === "cleanup") {
    return (
      <ConfirmDialog
        open
        title="清理未追蹤作品"
        description="確定清理所有未追蹤作品嗎？包含從未追蹤、只有閱讀紀錄的漫畫。會刪除作品資料、閱讀紀錄、已讀狀態、章節快取與更新提醒，並關閉相關閱讀分頁。已追蹤作品會保留。此操作無法復原。"
        confirmLabel="確認清理"
        busy={busy}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
  }

  if (dialogState.kind === "reset") {
    return (
      <ConfirmDialog
        open
        title="重置資料"
        description="確定重置所有資料？此操作會刪除更新、追蹤、紀錄與作品快取。"
        confirmLabel="重置資料"
        busy={busy}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
  }

  if (dialogState.kind === "history") {
    return (
      <ConfirmDialog
        open
        title="移除閱讀紀錄"
        description={`確定移除「${dialogState.item.title}」的閱讀紀錄嗎？追蹤、更新與作品資料會保留。`}
        confirmLabel="移除紀錄"
        busy={busy}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    );
  }

  return (
    <UnsubscribeSeriesDialog
      open
      title={dialogState.item.title}
      clearSeriesData={dialogState.clearSeriesData}
      busy={busy}
      onClearSeriesDataChange={onClearSeriesDataChange}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}
