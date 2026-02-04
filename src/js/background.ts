// @flow
import map from 'lodash/map';
import forEach from 'lodash/forEach';
import initObject from './util/initObject';
import { dm5, sf, comicbus } from './epics/sites';
import { storageGet, storageSet, storageClear } from './services/storage';

const dm5Regex = /https\:\/\/(tel||www)\.dm5\.com\/(m\d+)\//;
const sfRegex = /http\:\/\/comic\.sfacg\.com\/(HTML\/[^\/]+\/.+)$/;
const comicbusRegex = /http\:\/\/(www|v)\.comicbus.com\/online\/(comic-\d+\.html\?ch=.*$)/;

declare var chrome: any;
// declare var ga: any;

const fetchChapterPage$ = {
  sf: sf.fetchChapterPage$,
  dm5: dm5.fetchChapterPage$,
  comicbus: comicbus.fetchChapterPage$,
};

function dm5RefererHandler(details) {
  return {
    requestHeaders: [
      ...details.requestHeaders,
      {
        name: 'Referer',
        value: 'https://www.dm5.com/m',
      },
    ],
  };
}

function dm5CookieHandler(details) {
  return {
    requestHeaders: map(details.requestHeaders, item => {
      if (item.name === 'Cookie') {
        return {
          name: item.name,
          value: `${item.value};isAdult=1`,
        };
      }
      return item;
    }),
  };
}

function sfRefererHandler(details) {
  return {
    requestHeaders: [
      ...details.requestHeaders,
      {
        name: 'Referer',
        value: 'http://comic.sfacg.com/HTML/',
      },
    ],
  };
}

chrome.browserAction.setBadgeBackgroundColor({ color: '#F00' });

chrome.webRequest.onBeforeSendHeaders.addListener(
  dm5RefererHandler,
  { urls: ['https://www.dm5.com/m*/chapterfun*', 'https://*.cdndm5.com/*', 'https://*.cdnmanhua.net/*'] },
  ['requestHeaders', 'blocking', 'extraHeaders'],
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  dm5CookieHandler,
  { urls: ['https://www.dm5.com/m*/', 'https://*.cdnmanhua.net/*'] },
  ['requestHeaders', 'blocking', 'extraHeaders'],
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  sfRefererHandler,
  { urls: ['http://*.sfacg.com/*'] },
  ['requestHeaders', 'blocking', 'extraHeaders'],
);

chrome.notifications.onClicked.addListener(id => {
  if (id !== 'Comics Scroller Update') {
    chrome.tabs.create({ url: id });
  }
  chrome.notifications.clear(id);
});

function comicsQuery() {
storageGet(item => {
    if (typeof item !== 'undefined' && typeof item.subscribe !== 'undefined') {
      chrome.browserAction.setBadgeText({
        text: `${item.update.length > 0 ? item.update.length : ''}`,
      });
      forEach(item.subscribe, ({ site, comicsID }) => {
        const { url } = item[site][comicsID];
        if (!url) {
          console.log(item, `comicsID: ${comicsID}`);
          return;
        }
        const fetchChapterPage = fetchChapterPage$[site];
        fetchChapterPage(url).subscribe(
          ({ title, chapterList, cover, chapters }) => {
            const comic = item[site][comicsID];
            forEach(chapterList, chapterID => {
              if (!comic.chapters[chapterID]) {
                storageGet(oldStore =>
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
                      storageGet(store =>
                        chrome.browserAction.setBadgeText({
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

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'update') {
  storageGet(item => {
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
        iconUrl: './imgs/comics-128.png',
        title: 'Comics Scroller Update',
        message: `Comics Scroller 版本 ${version} 更新`,
      });
    });
  } else if (details.reason === 'install') {
    storageClear();
    storageSet(initObject);
  }
});

chrome.webNavigation.onBeforeNavigate.addListener(
  details => {
    if (comicbusRegex.test(details.url)) {
      console.log('comicbus fired');
      const chapter = comicbusRegex.exec(details.url)[2];
      chrome.tabs.update(details.tabId, {
        url: `${chrome.extension.getURL(
          'app.html',
        )}?site=comicbus&chapter=${chapter}`,
      });
      // ga('send', 'event', 'comicbus view');
    } else if (sfRegex.test(details.url)) {
      console.log('sf fired');
      const chapter = sfRegex.exec(details.url)[1];
      chrome.tabs.update(details.tabId, {
        url: `${chrome.extension.getURL(
          'app.html',
        )}?site=sf&chapter=${chapter}`,
      });
      // ga('send', 'event', 'sf view');
    } else if (dm5Regex.test(details.url)) {
      console.log('dm5 fired');
      let chapter = '';
      chapter = dm5Regex.exec(details.url)[2];
      chrome.tabs.update(details.tabId, {
        url: `${chrome.extension.getURL(
          'app.html',
        )}?site=dm5&chapter=${chapter}`,
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

chrome.alarms.onAlarm.addListener(alarm => {
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
