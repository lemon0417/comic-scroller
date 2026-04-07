import Content from "@components/Content";
import EmptyState from "@components/EmptyState";
import List from "@components/List";
import LoadingRows from "@components/LoadingRows";
import Panel from "@components/Panel";
import SeriesRow from "@components/SeriesRow";
import {
  POPUP_UPDATE_LIMIT,
  requestPopupData,
} from "@domain/actions/popup";
import {
  type PopupViewProps,
  selectPopupView,
} from "@domain/selectors/popupView";
import type { PopupFeedEntry } from "@infra/services/library/models";
import { openManagePage, openReaderPage } from "@utils/navigation";
import { useEffect } from "react";
import { connect } from "react-redux";

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="popup-section-header">
      <h2 className="popup-section-title">{title}</h2>
      <div className="popup-section-rule" aria-hidden="true" />
    </div>
  );
}

type PopupAppProps = Pick<
  PopupViewProps,
  "continueReading" | "hydrationStatus" | "update" | "updatesTruncated"
> & {
  requestPopupData: typeof requestPopupData;
};

function PopupAppComponent(props: PopupAppProps) {
  const {
    hydrationStatus,
    update,
    updatesTruncated,
    continueReading,
    requestPopupData: requestPopupDataProp,
  } = props;

  useEffect(() => {
    requestPopupDataProp("popup");
  }, [requestPopupDataProp]);

  const isLoading = hydrationStatus !== "ready";

  return (
    <div className="relative flex h-full w-full flex-col bg-comic-paper2 p-2">
      <Panel className="popup-panel rounded-[18px]">
        <div className="popup-header">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-comic-ink">
              更新
            </h1>
            <span className="ds-count-badge">{update.length}</span>
          </div>
          <button
            type="button"
            className="ds-btn-secondary"
            onClick={() => openManagePage("following")}
          >
            管理
          </button>
        </div>
        <Content variant="popup" className="popup-content">
          {isLoading ? (
            <LoadingRows />
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
                  <SectionTitle title="最新更新" />
                  {updatesTruncated ? (
                    <p className="mb-2 px-1 text-[11px] text-comic-ink/45">
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
      </Panel>
    </div>
  );
}

export default connect(selectPopupView, {
  requestPopupData,
})(PopupAppComponent);
