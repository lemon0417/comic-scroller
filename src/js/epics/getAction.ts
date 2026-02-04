// @flow
import {
  fetchChapterEpic as fetchChapterEpicDM5,
  fetchChapter as fetchChapterDM5,
  fetchImgSrcEpic as fetchImgSrcEpicDM5,
  fetchImgSrc as fetchImgSrcDM5,
  fetchImgListEpic as fetchImgListEpicDM5,
  fetchImgList as fetchImgListDM5,
  updateReadEpic as updateReadEpicDM5,
  updateRead as updateReadDM5,
} from './dm5Epic';

import {
  fetchChapterEpic as fetchChapterEpicSF,
  fetchChapter as fetchChapterSF,
  fetchImgSrcEpic as fetchImgSrcEpicSF,
  fetchImgSrc as fetchImgSrcSF,
  fetchImgListEpic as fetchImgListEpicSF,
  fetchImgList as fetchImgListSF,
  updateReadEpic as updateReadEpicSF,
  updateRead as updateReadSF,
} from './sfEpic';

import {
  fetchChapterEpic as fetchChapterEpicComicbus,
  fetchChapter as fetchChapterComicbus,
  fetchImgSrcEpic as fetchImgSrcEpicComicbus,
  fetchImgSrc as fetchImgSrcComicbus,
  fetchImgListEpic as fetchImgListEpicComicbus,
  fetchImgList as fetchImgListComicbus,
  updateReadEpic as updateReadEpicComicbus,
  updateRead as updateReadComicbus,
} from './comicBusEpic';

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
        fetchChapter: fetchChapterDM5,
        fetchImgSrc: fetchImgSrcDM5,
        fetchImgList: fetchImgListDM5,
        updateRead: updateReadDM5,
      };
    case 'sf':
      return {
        fetchChapter: fetchChapterSF,
        fetchImgSrc: fetchImgSrcSF,
        fetchImgList: fetchImgListSF,
        updateRead: updateReadSF,
      };
    case 'comicbus':
      return {
        fetchChapter: fetchChapterComicbus,
        fetchImgSrc: fetchImgSrcComicbus,
        fetchImgList: fetchImgListComicbus,
        updateRead: updateReadComicbus,
      };
    default:
      return {};
  }
}

function getEpic(site: any) {
  switch (site) {
    case 'dm5':
      return {
        fetchChapterEpic: fetchChapterEpicDM5,
        fetchImgSrcEpic: fetchImgSrcEpicDM5,
        fetchImgListEpic: fetchImgListEpicDM5,
        updateReadEpic: updateReadEpicDM5,
      };
    case 'sf':
      return {
        fetchChapterEpic: fetchChapterEpicSF,
        fetchImgSrcEpic: fetchImgSrcEpicSF,
        fetchImgListEpic: fetchImgListEpicSF,
        updateReadEpic: updateReadEpicSF,
      };
    case 'comicbus':
      return {
        fetchChapterEpic: fetchChapterEpicComicbus,
        fetchImgSrcEpic: fetchImgSrcEpicComicbus,
        fetchImgListEpic: fetchImgListEpicComicbus,
        updateReadEpic: updateReadEpicComicbus,
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
