export function openExternalUrl(url: string) {
  if (!url) return;
  chrome.tabs.create({ url });
}

export function openReaderPage(
  site: string,
  chapterID?: string,
  fallbackUrl = "",
) {
  if (site && chapterID) {
    const params = new URLSearchParams({ site, chapter: chapterID });
    chrome.tabs.create({
      url: `${chrome.runtime.getURL("app.html")}?${params.toString()}`,
    });
    return;
  }

  openExternalUrl(fallbackUrl);
}

export function openManagePage(tab = "following") {
  const params = new URLSearchParams({ tab });
  chrome.tabs.create({
    url: `${chrome.runtime.getURL("manage.html")}?${params.toString()}`,
  });
}
