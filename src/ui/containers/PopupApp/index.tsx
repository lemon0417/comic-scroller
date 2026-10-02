import Button from "@components/Button";
import Content from "@components/Content";
import CountBadge from "@components/CountBadge";
import EmptyState from "@components/EmptyState";
import List from "@components/List";
import LoadingRows from "@components/LoadingRows";
import ReleaseNoticeBanner from "@components/ReleaseNoticeBanner";
import SeriesRow from "@components/SeriesRow";
import {
  POPUP_UPDATE_LIMIT,
  requestDismissExtensionReleaseNotice,
  requestPopupData,
} from "@domain/actions/popup";
import { getPopupUpdateCount, type PopupFeedEntry } from "@domain/library";
import {
  type PopupViewProps,
  selectPopupView,
} from "@domain/selectors/popupView";
import { openManagePage, openReaderPage } from "@utils/navigation";
import { useEffect } from "react";
import { connect } from "react-redux";

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="popup-section-header">
      <h2 className="popup-section-title">
        {title}
        {typeof count === "number" ? (
          <CountBadge aria-label={`更新數：${count}`}>{count}</CountBadge>
        ) : null}
      </h2>
      <div className="popup-section-rule" aria-hidden="true" />
    </div>
  );
}

type PopupAppProps = Pick<
  PopupViewProps,
  | "continueReading"
  | "extensionReleaseNotice"
  | "hydrationStatus"
  | "update"
  | "updatesTruncated"
> & {
  updateCount?: number;
  requestDismissExtensionReleaseNotice: typeof requestDismissExtensionReleaseNotice;
  requestPopupData: typeof requestPopupData;
};

function PopupAppComponent(props: PopupAppProps) {
  const {
    hydrationStatus,
    update,
    updateCount,
    updatesTruncated,
    continueReading,
    extensionReleaseNotice,
    requestDismissExtensionReleaseNotice:
      requestDismissExtensionReleaseNoticeProp,
    requestPopupData: requestPopupDataProp,
  } = props;
  const displayUpdateCount =
    typeof updateCount === "number"
      ? updateCount
      : getPopupUpdateCount({ update });

  useEffect(() => {
    requestPopupDataProp("popup");
  }, [requestPopupDataProp]);

  const isLoading = hydrationStatus !== "ready";

  return (
    <div className="popup-shell">
      <header className="popup-header">
        <div className="min-w-0">
          <h1 className="popup-title">更新</h1>
          <p className="popup-subtitle">繼續閱讀與新章節</p>
        </div>
        <Button variant="secondary" onClick={() => openManagePage("following")}>
          管理
        </Button>
      </header>
      <Content variant="popup" className="popup-content">
        {extensionReleaseNotice ? (
          <ReleaseNoticeBanner
            className="mb-5"
            density="popup"
            notice={extensionReleaseNotice}
            onDismiss={requestDismissExtensionReleaseNoticeProp}
          />
        ) : null}
        {isLoading ? (
          <LoadingRows variant="popup" />
        ) : (
          <List className="popup-list">
            {continueReading ? (
              <section className="popup-section">
                <SectionTitle title="繼續閱讀" />
                <SeriesRow
                  variant="popup"
                  title={continueReading.title}
                  titleHref={continueReading.url}
                  siteLabel={continueReading.siteLabel}
                  cover={continueReading.cover}
                  summary={`上次閱讀：${continueReading.lastReadTitle}`}
                  detail={`最新章節：${continueReading.lastChapterTitle}`}
                  actions={[
                    {
                      icon: "arrow",
                      label: "繼續",
                      variant: "primary",
                      onClick: () =>
                        openReaderPage(
                          continueReading.site,
                          continueReading.continueChapterID,
                          continueReading.continueHref,
                        ),
                    },
                  ]}
                />
              </section>
            ) : null}

            {update.length > 0 ? (
              <section className="popup-section">
                <SectionTitle title="最新更新" count={displayUpdateCount} />
                {updatesTruncated ? (
                  <p className="mb-2 px-1 text-[11px] text-comic-ink/50">
                    僅顯示最新 {POPUP_UPDATE_LIMIT} 筆，請前往管理頁查看全部。
                  </p>
                ) : null}
                <div className="popup-feed-list">
                  {update.map((item: PopupFeedEntry) => (
                    <SeriesRow
                      key={item.key}
                      variant="popup"
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
                              item.updateChapterHref ||
                                item.lastChapterHref ||
                                item.url,
                            ),
                        },
                      ]}
                    />
                  ))}
                </div>
              </section>
            ) : continueReading ? (
              <EmptyState
                title="目前沒有新章節"
                description="可繼續上次閱讀，或前往管理頁查看收藏。"
              />
            ) : (
              <EmptyState
                title="尚無更新"
                description="可先到閱讀頁追蹤作品。"
              />
            )}
          </List>
        )}
      </Content>
    </div>
  );
}

function selectPopupAppView(state: Parameters<typeof selectPopupView>[0]) {
  return {
    ...selectPopupView(state),
    updateCount: getPopupUpdateCount(state.popup.feed),
  };
}

export default connect(selectPopupAppView, {
  requestDismissExtensionReleaseNotice,
  requestPopupData,
})(PopupAppComponent);
