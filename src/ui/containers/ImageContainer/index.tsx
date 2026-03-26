import { Component } from "react";
import { connect } from "react-redux";
import { createSelector } from "reselect";
import map from "lodash/map";
import reduce from "lodash/reduce";
import filter from "lodash/filter";
import Loading from "@components/Loading";
import ConnectedComicImage from "@components/ComicImage";
import {
  READER_BOTTOM_PADDING,
  READER_HEADER_HEIGHT,
  READER_IMAGE_GAP,
  READER_TOP_PADDING,
  getImageBlockHeight,
} from "@domain/utils/readerLayout";

class ImageContainer extends Component<any, any> {
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
  (comics: any) => comics.imageList.result,
  (comics: any) => comics.renderBeginIndex,
  (comics: any) => comics.renderEndIndex,
  (result, begin, end) =>
    filter(result, (item) => item >= begin && item <= end),
);

const getPaddingTop = createSelector(
  (comics: any) => comics.imageList.result,
  (comics: any) => comics.imageList.entity,
  (comics: any) => comics.renderBeginIndex,
  (comics: any) => comics.innerWidth,
  (comics: any) => comics.innerHeight,
  (result, entity, begin, innerWidth, innerHeight) =>
    reduce(
      filter(result, (item) => item < begin),
      (acc, i) => {
        return (
          acc +
          getImageBlockHeight(entity[i], innerWidth, innerHeight) +
          2 * READER_IMAGE_GAP
        );
      },
      0,
    ),
);

const getPaddingBottom = createSelector(
  (comics: any) => comics.imageList.result,
  (comics: any) => comics.imageList.entity,
  (comics: any) => comics.renderEndIndex,
  (comics: any) => comics.innerWidth,
  (comics: any) => comics.innerHeight,
  (result, entity, end, innerWidth, innerHeight) =>
    reduce(
      filter(result, (item) => item > end),
      (acc, i) => {
        return (
          acc +
          getImageBlockHeight(entity[i], innerWidth, innerHeight) +
          2 * READER_IMAGE_GAP
        );
      },
      0,
    ),
);

function mapStateToProps({ comics }: { comics: any }) {
  return {
    paddingTop: getPaddingTop(comics),
    paddingBottom: getPaddingBottom(comics),
    renderResult: getRenderResult(comics),
  };
}

export default connect(mapStateToProps)(ImageContainer as any);
