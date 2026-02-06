import forEach from 'lodash/forEach';
import initObject from './util/initObject';
import * as dm5 from './background/sites/dm5';
import * as sf from './background/sites/sf';
import * as comicbus from './background/sites/comicbus';
import { storageGet, storageSet, storageClear } from './services/storage';

const dm5Regex = /https\:\/\/(tel||www)\.dm5\.com\/(m\d+)\//;
const sfRegex = /http\:\/\/comic\.sfacg\.com\/(HTML\/[^\/]+\/.+)$/;
const comicbusRegex = /http\:\/\/(www|v)\.comicbus.com\/online\/(comic-\d+\.html\?ch=.*$)/;
const isDev = import.meta.env.MODE !== 'production';

declare var chrome: any;
// declare var ga: any;

const fetchChapterPage$ = {
  sf: sf.fetchChapterPage$,
  dm5: dm5.fetchChapterPage$,
  comicbus: comicbus.fetchChapterPage$,
};

async function storageGetAsync() {
  return new Promise<any>(resolve => storageGet((item: any) => resolve(item)));
}

async function storageSetAsync(data: any) {
  return new Promise<void>(resolve => storageSet(data, () => resolve()));
}

function computeUpdateDiff(before: any, after: any) {
  const beforeSet = new Set(
    (before?.update || []).map(
      (item: any) => `${item.site}:${item.comicsID}:${item.chapterID}`,
    ),
  );
  const afterSet = new Set(
    (after?.update || []).map(
      (item: any) => `${item.site}:${item.comicsID}:${item.chapterID}`,
    ),
  );
  let added = 0;
  afterSet.forEach(key => {
    if (!beforeSet.has(key)) added += 1;
  });
  return {
    before: before?.update?.length || 0,
    after: after?.update?.length || 0,
    added,
  };
}

async function comicsQuerySummary() {
  const before = await storageGetAsync();
  let checked = 0;
  let updated = 0;
  let errors = 0;

  if (before && before.subscribe && Array.isArray(before.subscribe)) {
    const newStore = { ...before };
    const newUpdate = Array.isArray(before.update) ? [...before.update] : [];
    for (const sub of before.subscribe) {
      const { site, comicsID } = sub || {};
      if (!site || !comicsID || !before[site] || !before[site][comicsID]) {
        continue;
      }
      checked += 1;
      try {
        const { url } = before[site][comicsID];
        const fetchChapterPage = (fetchChapterPage$ as any)[site];
        const result$ =
          site === 'comicbus'
            ? fetchChapterPage(url, comicsID)
            : fetchChapterPage(url);
        await new Promise<void>((resolve, _reject) => {
          result$.subscribe(
            ({ title, chapterList, cover, chapters }: any) => {
              const comic = before[site][comicsID];
              for (const chapterID of chapterList || []) {
                if (!comic.chapters[chapterID]) {
                  newStore[site] = {
                    ...newStore[site],
                    [comicsID]: {
                      ...newStore[site][comicsID],
                      title,
                      chapterList,
                      cover,
                      chapters,
                    },
                  };
                  newUpdate.unshift({
                    site,
                    chapterID,
                    updateChapter: {
                      title: chapters[chapterID].title,
                      href: chapters[chapterID].href,
                    },
                    comicsID,
                  });
                  updated += 1;
                }
              }
              resolve();
            },
            () => {
              errors += 1;
              resolve();
            },
          );
        });
      } catch {
        errors += 1;
      }
    }
    await storageSetAsync({ ...newStore, update: newUpdate });
    chrome.action.setBadgeText({
      text: `${newUpdate.length > 0 ? newUpdate.length : ''}`,
    });
  }

  const after = await storageGetAsync();
  return {
    checked,
    updated,
    errors,
    diff: computeUpdateDiff(before, after),
  };
}

chrome.action.setBadgeBackgroundColor({ color: '#F00' });

chrome.notifications.onClicked.addListener((id: any) => {
  if (id !== 'Comics Scroller Update') {
    chrome.tabs.create({ url: id });
  }
  chrome.notifications.clear(id);
});

function comicsQuery() {
  storageGet((item: any) => {
    if (typeof item !== 'undefined' && typeof item.subscribe !== 'undefined') {
      chrome.action.setBadgeText({
        text: `${item.update.length > 0 ? item.update.length : ''}`,
      });
      forEach(item.subscribe, ({ site, comicsID }) => {
        const { url } = item[site][comicsID];
        if (!url) {
          console.log(item, `comicsID: ${comicsID}`);
          return;
        }
        const fetchChapterPage = (fetchChapterPage$ as any)[site];
        const result$ =
          site === 'comicbus'
            ? fetchChapterPage(url, comicsID)
            : fetchChapterPage(url);
        result$.subscribe(
          ({ title, chapterList, cover, chapters }: any) => {
            const comic = item[site][comicsID];
            forEach(chapterList, chapterID => {
              if (!comic.chapters[chapterID]) {
                storageGet((oldStore: any) =>
                  storageSet(
                    {
                      ...oldStore,
                      [site]: {
                        ...oldStore[site],
                        [comicsID]: {
                          ...oldStore[site][comicsID],
                          title,
                          chapterList,
                          cover,
                          chapters,
                        },
                      },
                      update: [
                        {
                          site,
                          chapterID,
                          updateChapter: {
                            title: chapters[chapterID].title,
                            href: chapters[chapterID].href,
                          },
                          comicsID,
                        },
                        ...oldStore.update,
                      ],
                    },
                    () => {
                      storageGet((store: any) =>
                        chrome.action.setBadgeText({
                          text: `${store.update.length}`,
                        }),
                      );
                    },
                  ),
                );
              }
            });
          },
        );
      });
    }
  });
}

chrome.runtime.onInstalled.addListener((details: any) => {
  if (details.reason === 'update') {
    storageGet((item: any) => {
      const { version } = chrome.runtime.getManifest();
      delete item.udpate;
      if (!item.version) {
        storageClear();
        storageSet(initObject);
      } else {
        storageSet({ ...initObject, ...item });
      }
      chrome.notifications.create('Comics Scroller Update', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('imgs/comics-128.png'),
        title: 'Comics Scroller Update',
        message: `Comics Scroller 版本 ${version} 更新`,
      });
    });
  } else if (details.reason === 'install') {
    storageClear();
    storageSet(initObject);
  }
});

chrome.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
  if (message && message.msg === 'PING_BACKGROUND') {
    if (!isDev) {
      sendResponse({ ok: false, reason: 'disabled' });
      return false;
    }
    comicsQuerySummary().then(summary => {
      sendResponse({ ok: true, at: Date.now(), summary });
    });
    return true;
  }
  return false;
});

chrome.webNavigation.onBeforeNavigate.addListener(
  (details: any) => {
    if (comicbusRegex.test(details.url)) {
      console.log('comicbus fired');
      const match = comicbusRegex.exec(details.url);
      if (!match) return;
      const chapter = match[2];
      chrome.tabs.update(details.tabId, {
        url: `${chrome.runtime.getURL('app.html')}?site=comicbus&chapter=${chapter}`,
      });
      // ga('send', 'event', 'comicbus view');
    } else if (sfRegex.test(details.url)) {
      console.log('sf fired');
      const match = sfRegex.exec(details.url);
      if (!match) return;
      const chapter = match[1];
      chrome.tabs.update(details.tabId, {
        url: `${chrome.runtime.getURL('app.html')}?site=sf&chapter=${chapter}`,
      });
      // ga('send', 'event', 'sf view');
    } else if (dm5Regex.test(details.url)) {
      console.log('dm5 fired');
      const match = dm5Regex.exec(details.url);
      if (!match) return;
      let chapter = '';
      chapter = match[2];
      chrome.tabs.update(details.tabId, {
        url: `${chrome.runtime.getURL('app.html')}?site=dm5&chapter=${chapter}`,
      });
      // ga('send', 'event', 'dm5 view');
    }
  },
  {
    url: [
      { urlMatches: 'comicbus.com/online/.*$' },
      { urlMatches: 'comic.sfacg.com/HTML/[^/]+/.+$' },
      { urlMatches: 'https://(tel||www).dm5.com/md*' },
    ],
  },
);

chrome.alarms.create('comcisScroller', {
  when: Date.now(),
  periodInMinutes: 10,
});

chrome.alarms.onAlarm.addListener((alarm: any) => {
  if (alarm.name === 'comcisScroller') {
    comicsQuery();
  }
});

/* eslint-disable */
// prettier-ignore
// (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
// (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
// // $FlowFixMe
// m=s.getElementsByTagName(o)[0];a.alocal=1;a.src=g;m.parentNode.insertBefore(a,m)
// })(window,document,'script','https://ssl.google-analytics.com/analytics.js','ga');
// ga('create', 'UA-59728771-1', 'auto');
// ga('set', 'checkProtocolTask', null);
// ga('send', 'pageview');
