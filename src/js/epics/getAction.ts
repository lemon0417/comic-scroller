// @flow
import { dm5, sf, comicbus } from './sites';

function getInfor(site: any) {
  switch (site) {
    case 'dm5':
      return {
        site,
        baseURL: 'https://www.dm5.com',
      };
    case 'sf':
      return {
        site,
        baseURL: 'http://comic.sfacg.com',
      };
    case 'comicbus':
      return {
        site,
        baseURL: 'http://www.comicbus.com',
      };
    default:
      return {};
  }
}

function getAction(site: any) {
  switch (site) {
    case 'dm5':
      return {
        fetchChapter: dm5.fetchChapter,
        fetchImgSrc: dm5.fetchImgSrc,
        fetchImgList: dm5.fetchImgList,
        updateRead: dm5.updateRead,
      };
    case 'sf':
      return {
        fetchChapter: sf.fetchChapter,
        fetchImgSrc: sf.fetchImgSrc,
        fetchImgList: sf.fetchImgList,
        updateRead: sf.updateRead,
      };
    case 'comicbus':
      return {
        fetchChapter: comicbus.fetchChapter,
        fetchImgSrc: comicbus.fetchImgSrc,
        fetchImgList: comicbus.fetchImgList,
        updateRead: comicbus.updateRead,
      };
    default:
      return {};
  }
}

function getEpic(site: any) {
  switch (site) {
    case 'dm5':
      return {
        fetchChapterEpic: dm5.fetchChapterEpic,
        fetchImgSrcEpic: dm5.fetchImgSrcEpic,
        fetchImgListEpic: dm5.fetchImgListEpic,
        updateReadEpic: dm5.updateReadEpic,
      };
    case 'sf':
      return {
        fetchChapterEpic: sf.fetchChapterEpic,
        fetchImgSrcEpic: sf.fetchImgSrcEpic,
        fetchImgListEpic: sf.fetchImgListEpic,
        updateReadEpic: sf.updateReadEpic,
      };
    case 'comicbus':
      return {
        fetchChapterEpic: comicbus.fetchChapterEpic,
        fetchImgSrcEpic: comicbus.fetchImgSrcEpic,
        fetchImgListEpic: comicbus.fetchImgListEpic,
        updateReadEpic: comicbus.updateReadEpic,
      };
    default:
      return {};
  }
}

const _site = /site=(.*)&/.test(document.URL)
  ? /site=(.*)&/.exec(document.URL)![1]
  : ''; //eslint-disable-line

export const { site, baseURL } = getInfor(_site);

export const {
  fetchChapter,
  fetchImgSrc,
  fetchImgList,
  updateRead,
} = getAction(_site);

export const {
  fetchChapterEpic,
  fetchImgSrcEpic,
  fetchImgListEpic,
  updateReadEpic,
} = getEpic(_site);
