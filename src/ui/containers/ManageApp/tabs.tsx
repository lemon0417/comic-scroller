import type { PopupFeedEntry } from "@domain/library";
import { IS_DEVELOPMENT_BUILD } from "@utils/buildMode";

import type { ManageFeedTab, ManageTab } from "./types";

export function getManageTabOptions(): ManageTab[] {
  return [
    "updates",
    "following",
    "history",
    "data",
    ...(IS_DEVELOPMENT_BUILD ? ["developer" as const] : []),
  ];
}

type TabConfig = {
  label: string;
  emptyTitle?: string;
  emptyDescription?: string;
};
export const MANAGE_TAB_CONFIG: Record<ManageFeedTab | "data", TabConfig> = {
  updates: {
    label: "更新",
    emptyTitle: "目前沒有更新",
    emptyDescription: "已追蹤作品目前沒有新章節。",
  },
  following: {
    label: "追蹤",
    emptyTitle: "尚未追蹤作品",
    emptyDescription: "在閱讀頁追蹤作品後會顯示於此。",
  },
  history: {
    label: "紀錄",
    emptyTitle: "尚無閱讀紀錄",
    emptyDescription: "開始閱讀後會顯示於此。",
  },
  data: {
    label: "選項",
  },
};

export function getManageTabLabel(tab: ManageTab) {
  if (IS_DEVELOPMENT_BUILD && tab === "developer") return "開發者";
  return tab === "developer" ? "" : MANAGE_TAB_CONFIG[tab].label;
}

export function renderTabLabel(label: string, count?: number) {
  return (
    <span className="manage-tab-label">
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className="manage-tab-count">{count}</span>
      ) : null}
    </span>
  );
}

export function getInitialTab(): ManageTab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return getManageTabOptions().includes(tab as ManageTab)
    ? (tab as ManageTab)
    : "following";
}

export function getRowsForManageTab(
  selectedTab: ManageTab,
  rows: Record<ManageFeedTab, PopupFeedEntry[]>,
) {
  return selectedTab === "data" || selectedTab === "developer"
    ? []
    : rows[selectedTab];
}
