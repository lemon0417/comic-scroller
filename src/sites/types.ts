export type SiteAdapter = {
  key: string;
  baseURL: string;
  fetchMeta: (...args: any[]) => any;
  epics: {
    fetchChapterEpic: Function;
    fetchImgSrcEpic: Function;
    fetchImgListEpic: Function;
    updateReadEpic: Function;
  };
  background: {
    fetchChapterPage$: (...args: any[]) => any;
  };
};
