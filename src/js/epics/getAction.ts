import { dm5, sf, comicbus } from './sites';

function getInfor(site: string) {
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

function getAction(site: string) {
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

function getEpic(site: string) {
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

const inferSite = (siteParam: string, chapterParam: string) => {
  if (siteParam) return siteParam;
  if (/^m\d+$/i.test(chapterParam)) return 'dm5';
  if (/^comic-\d+\.html\?ch=/i.test(chapterParam)) return 'comicbus';
  if (chapterParam.startsWith('HTML/')) return 'sf';
  return '';
};

const searchParams = new URLSearchParams(window.location.search);
const siteParam = searchParams.get('site') || '';
const chapterParam = searchParams.get('chapter') || '';
const _site = inferSite(siteParam, chapterParam);

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
