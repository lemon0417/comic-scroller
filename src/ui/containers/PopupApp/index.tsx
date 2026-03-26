import { useEffect } from "react";
import { connect } from "react-redux";
import Content from "@components/Content";
import EmptyState from "@components/EmptyState";
import List from "@components/List";
import LoadingRows from "@components/LoadingRows";
import Panel from "@components/Panel";
import SeriesRow from "@components/SeriesRow";
import { requestPopupData } from "@domain/actions/popup";
import { selectPopupView } from "@domain/selectors/popupView";

declare var chrome: any;

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

function openManagePage(tab = "following") {
  const params = new URLSearchParams({ tab });
  chrome.tabs.create({
    url: `${chrome.runtime.getURL("manage.html")}?${params.toString()}`,
  });
}

function SectionTitle({ title, count }: { title: string; count?: number }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-medium tracking-[0.02em] text-comic-ink/50">
        {title}
      </h2>
      {typeof count === "number" ? (
        <span className="ds-count-badge">{count}</span>
      ) : null}
    </div>
  );
}

function PopupAppComponent(props: any) {
  const {
    hydrationStatus,
    update,
    continueReading,
    requestPopupData: requestPopupDataProp,
  } = props;

  useEffect(() => {
    requestPopupDataProp();
  }, [requestPopupDataProp]);

  const isLoading = hydrationStatus !== "ready";

  return (
    <div className="relative flex h-full w-full flex-col bg-comic-paper2 p-2">
      <Panel className="rounded-[18px]">
        <div className="flex items-center justify-between gap-3 border-b border-comic-ink/10 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="text-[17px] font-semibold tracking-[-0.02em] text-comic-ink">
              Updates
            </h1>
            <span className="ds-count-badge">{update.length}</span>
          </div>
          <button
            type="button"
            className="ds-btn-secondary"
            onClick={() => openManagePage("following")}
          >
            Manage
          </button>
        </div>
        <Content className="px-4 pb-4 pt-4">
          {isLoading ? (
            <LoadingRows />
          ) : (
            <List className="gap-4">
              {continueReading ? (
                <section>
                  <SectionTitle title="Continue reading" />
                  <SeriesRow
                    title={continueReading.title}
                    siteLabel={continueReading.siteLabel}
                    cover={continueReading.cover}
                    summary={`Last read • ${continueReading.lastReadTitle}`}
                    detail={`Latest • ${continueReading.lastChapterTitle}`}
                    actions={[
                      {
                        label: "Continue",
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
                <section>
                  <SectionTitle title="New updates" count={update.length} />
                  <div className="flex flex-col gap-3">
                    {update.map((item: any) => (
                      <SeriesRow
                        key={item.key}
                        title={item.title}
                        siteLabel={item.siteLabel}
                        cover={item.cover}
                        summary={`New chapter • ${item.updateChapterTitle || item.lastChapterTitle}`}
                        detail={`Last read • ${item.lastReadTitle}`}
                        actions={[
                          {
                            label: "Read update",
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
                          {
                            label: "Open series",
                            onClick: () => openUrl(item.url),
                          },
                        ]}
                      />
                    ))}
                  </div>
                </section>
              ) : continueReading ? (
                <EmptyState
                  title="You're caught up"
                  description={
                    "No new chapters right now. Continue where you left off, or review your library from Manage."
                  }
                />
              ) : (
                <EmptyState
                  title="You're all set"
                  description={
                    "No updates yet. Use Manage to follow a series and keep your library in sync."
                  }
                />
              )}
            </List>
          )}
        </Content>
      </Panel>
    </div>
  );
}

export { PopupAppComponent as PopupApp };

export default connect(selectPopupView, {
  requestPopupData,
})(PopupAppComponent);
