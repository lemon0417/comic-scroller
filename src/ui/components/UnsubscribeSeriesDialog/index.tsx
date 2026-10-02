import CheckboxField from "@components/CheckboxField";
import ConfirmDialog from "@components/ConfirmDialog";
import { useId } from "react";

type UnsubscribeSeriesDialogProps = {
  open: boolean;
  title: string;
  clearSeriesData: boolean;
  busy: boolean;
  onClearSeriesDataChange: (checked: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export default function UnsubscribeSeriesDialog({
  open,
  title,
  clearSeriesData,
  busy,
  onClearSeriesDataChange,
  onClose,
  onConfirm,
}: UnsubscribeSeriesDialogProps) {
  const checkboxId = useId();
  const descriptionId = useId();
  return (
    <ConfirmDialog
      open={open}
      title="取消追蹤作品"
      description={`確定取消追蹤「${title}」嗎？更新提醒會一併清除。取消勾選可保留閱讀紀錄；無列表引用的快取仍會自動回收。`}
      confirmLabel="確認取消追蹤"
      busy={busy}
      onClose={onClose}
      onConfirm={onConfirm}
    >
      <CheckboxField
        id={checkboxId}
        descriptionId={descriptionId}
        label="一併清除閱讀紀錄與作品資料"
        description="勾選後會刪除閱讀紀錄、已讀狀態與章節快取，並關閉此作品已開啟的閱讀分頁。此操作無法復原。"
        checked={clearSeriesData}
        disabled={busy}
        onChange={(event) =>
          onClearSeriesDataChange(event.currentTarget.checked)
        }
      />
    </ConfirmDialog>
  );
}
