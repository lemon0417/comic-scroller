import { Component } from "react";
import { connect } from "react-redux";
import map from "lodash/map";
import {
  resetImg,
  updateChapterLatestIndex,
  updateRenderIndex,
} from "../../reducers/comics";
import { fetchImgList, updateRead } from "../../epics/sites/dm5";
import { stopScroll } from "../../epics/scrollEpic";

class ChapterList extends Component<any, any> {
  node!: HTMLDivElement;

  onClickHandler = () => {
    this.node.scrollTop = 0;
    this.props.showChapterListHandler();
  };

  refHandler = (node: HTMLDivElement | null) => {
    if (!node) return;
    this.node = node;
  };

  chapterClickHandler = (e: any) => {
    const target = e.target as HTMLElement;
    const indexAttr = target?.dataset?.index;
    if (indexAttr) {
      const index = parseInt(indexAttr, 10);
      this.props.stopScroll();
      this.props.resetImg();
      this.props.updateRead(index);
      this.props.updateChapterLatestIndex(index);
      this.props.updateRenderIndex(0, 6);
      this.props.fetchImgList(index);
    }
  };

  render() {
    const modalBase =
      "fixed inset-0 z-[1000] flex h-screen items-center justify-center bg-[rgba(0,0,0,0.4)] opacity-0 transition-opacity duration-300 ease-in-out pointer-events-none will-change-[scroll-position]";
    const modalClass = this.props.show
      ? `${modalBase} opacity-100 pointer-events-auto`
      : modalBase;
    const panelBase =
      "relative flex h-[90vh] w-[50vw] min-w-[900px] scale-0 flex-col items-center justify-center bg-white shadow-paper-2 transition-transform duration-300 ease-in-out will-change-[scroll-position]";
    const panelClass = this.props.show
      ? `${panelBase} scale-100`
      : panelBase;
    const contentClass =
      "flex h-[calc(90vh-48px)] w-full flex-wrap content-start items-start overflow-y-auto py-5";
    const itemBase =
      "h-10 w-[200px] flex-[1_0_auto] max-w-[calc(25%-8px)] rounded-[5px] border border-current text-center text-base leading-10 m-1";
    const chapterBase = "cursor-pointer overflow-hidden";
    const chapterClass = `${itemBase} ${chapterBase} text-[cadetblue] hover:bg-[cadetblue] hover:text-white`;
    const chapterReadClass = `${itemBase} ${chapterBase} text-grey-400 hover:bg-grey-400 hover:text-white`;

    return (
      <div
        className={modalClass}
        onClick={this.props.show ? this.onClickHandler : undefined}
      >
        <div
          className={panelClass}
          ref={this.refHandler}
        >
          <div className="h-12 w-full bg-grey-800 text-center text-[24px] leading-[48px] text-grey-300">
            章節
          </div>
          <div className={contentClass} onClick={this.chapterClickHandler}>
            {map(this.props.chapterList, (item, i) => (
              <div
                className={item.read ? chapterReadClass : chapterClass}
                key={i}
                data-chapter={item.chapter}
                data-index={i}
              >
                {item.title}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state: any) {
  const { read, chapterList, chapters } = state.comics;
  return {
    chapterList: map(chapterList, (item) => ({
      ...chapters[item],
      read: read.includes(item),
    })),
  };
}

export default connect(mapStateToProps, {
  stopScroll,
  resetImg,
  updateRead,
  updateRenderIndex,
  updateChapterLatestIndex,
  fetchImgList,
})(ChapterList as any);
