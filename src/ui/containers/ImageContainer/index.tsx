import { Component } from "react";
import { connect } from "react-redux";
import { createSelector } from "reselect";
import map from "lodash/map";
import Loading from "@components/Loading";
import ConnectedComicImage from "@components/ComicImage";
import type { ComicsState } from "@domain/reducers/comics";
import {
  READER_BOTTOM_PADDING,
  READER_HEADER_HEIGHT,
  READER_TOP_PADDING,
  buildImageOffsetLayout,
} from "@domain/utils/readerLayout";

type ImageContainerProps = {
  paddingBottom: number;
  paddingTop: number;
  renderResult: number[];
};

class ImageContainer extends Component<ImageContainerProps> {
  render() {
    return (
      <main
        className="reader-canvas"
        aria-label="Comic pages"
        style={{
          paddingTop:
            this.props.paddingTop + READER_HEADER_HEIGHT + READER_TOP_PADDING,
          paddingBottom: this.props.paddingBottom + READER_BOTTOM_PADDING,
        }}
      >
        {this.props.renderResult.length > 0 ? (
          map(this.props.renderResult, (key) => (
            <ConnectedComicImage key={key} index={key} />
          ))
        ) : (
          <Loading />
        )}
      </main>
    );
  }
}

const getRenderResult = createSelector(
  (comics: ComicsState) => comics.imageList.result,
  (comics: ComicsState) => comics.renderBeginIndex,
  (comics: ComicsState) => comics.renderEndIndex,
  (result, begin, end) =>
    result.slice(
      Math.max(0, begin),
      Math.max(0, Math.min(result.length, end + 1)),
    ),
);

const getImageOffsetLayout = createSelector(
  (comics: ComicsState) => comics.imageList.result,
  (comics: ComicsState) => comics.imageList.entity,
  (comics: ComicsState) => comics.innerWidth,
  (comics: ComicsState) => comics.innerHeight,
  buildImageOffsetLayout,
);

const getPaddingTop = createSelector(
  getImageOffsetLayout,
  (comics: ComicsState) => comics.renderBeginIndex,
  (layout, begin) => layout.offsets[Math.max(0, Math.min(begin, layout.offsets.length - 1))],
);

const getPaddingBottom = createSelector(
  getImageOffsetLayout,
  (comics: ComicsState) => comics.renderEndIndex,
  (layout, end) =>
    layout.totalHeight -
    layout.offsets[Math.max(0, Math.min(end + 1, layout.offsets.length - 1))],
);

function mapStateToProps({ comics }: { comics: ComicsState }) {
  return {
    paddingTop: getPaddingTop(comics),
    paddingBottom: getPaddingBottom(comics),
    renderResult: getRenderResult(comics),
  };
}

export default connect(mapStateToProps)(ImageContainer);
