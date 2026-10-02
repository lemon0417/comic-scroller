import EmptyState from "@components/EmptyState";
import LoadingRows from "@components/LoadingRows";
import SeriesRow from "@components/SeriesRow";
import { requestRemoveCard } from "@domain/actions/popup";
import type { PopupFeedEntry } from "@domain/library";
import { openReaderPage } from "@utils/navigation";
import { useMemo } from "react";
import {
  List,
  type RowComponentProps,
  useDynamicRowHeight,
} from "react-window";

import { MANAGE_TAB_CONFIG } from "./tabs";
import type { ManageFeedTab } from "./types";

const MANAGE_ROW_DEFAULT_HEIGHT = 112;
const MANAGE_LIST_OVERSCAN_COUNT = 6;

type ManageRowsListProps = {
  busy: boolean;
  selectedTab: ManageFeedTab;
  rows: PopupFeedEntry[];
  onRequestAbandonSeries: (item: PopupFeedEntry) => void;
  onRequestHistoryRemoval: (item: PopupFeedEntry) => void;
  onRemoveCard: typeof requestRemoveCard;
};

function ManageFeedRow({
  ariaAttributes,
  busy,
  index,
  onRequestAbandonSeries,
  onRequestHistoryRemoval,
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
      <div {...ariaAttributes} style={style}>
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
              disabled: busy,
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
      <div {...ariaAttributes} style={style}>
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
              disabled: busy,
              onClick: () => onRequestAbandonSeries(item),
            },
          ]}
        />
      </div>
    );
  }

  return (
    <div {...ariaAttributes} style={style}>
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
            icon: "trash",
            label: "移除",
            variant: "danger",
            disabled: busy,
            onClick: () => onRequestHistoryRemoval(item),
          },
        ]}
      />
    </div>
  );
}

type ManageFeedListProps = {
  busy: boolean;
  currentRows: PopupFeedEntry[];
  filteredRows: PopupFeedEntry[];
  isLoading: boolean;
  isSearching: boolean;
  searchKey: string;
  selectedTab: ManageFeedTab;
  onRemoveCard: typeof requestRemoveCard;
  onRequestAbandonSeries: (item: PopupFeedEntry) => void;
  onRequestHistoryRemoval: (item: PopupFeedEntry) => void;
};

export function ManageFeedList({
  busy,
  currentRows,
  filteredRows,
  isLoading,
  isSearching,
  searchKey,
  selectedTab,
  onRemoveCard,
  onRequestAbandonSeries,
  onRequestHistoryRemoval,
}: ManageFeedListProps) {
  const rowHeights = useDynamicRowHeight({
    defaultRowHeight: MANAGE_ROW_DEFAULT_HEIGHT,
    key: `${selectedTab}:${searchKey}`,
  });

  const rowProps = useMemo<ManageRowsListProps>(
    () => ({
      busy,
      selectedTab,
      rows: filteredRows,
      onRequestAbandonSeries,
      onRequestHistoryRemoval,
      onRemoveCard,
    }),
    [
      busy,
      filteredRows,
      onRemoveCard,
      onRequestAbandonSeries,
      onRequestHistoryRemoval,
      selectedTab,
    ],
  );

  if (isLoading) {
    return <LoadingRows count={4} />;
  }

  if (isSearching && currentRows.length > 0 && filteredRows.length === 0) {
    return (
      <EmptyState
        title="找不到符合的作品"
        description="請用作品名或作品 ID 搜尋。"
      />
    );
  }

  if (currentRows.length === 0) {
    const config = MANAGE_TAB_CONFIG[selectedTab];
    return (
      <EmptyState
        title={config.emptyTitle || ""}
        description={config.emptyDescription || ""}
      />
    );
  }

  return (
    <List
      className="manage-feed-list popup-scrollbar scrollbar-stable"
      overscanCount={MANAGE_LIST_OVERSCAN_COUNT}
      rowComponent={ManageFeedRow}
      rowCount={filteredRows.length}
      rowHeight={rowHeights}
      rowProps={rowProps}
      style={{
        width: "100%",
      }}
    />
  );
}
