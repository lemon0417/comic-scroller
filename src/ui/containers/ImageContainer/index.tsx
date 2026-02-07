import { Component } from "react";
import { connect } from "react-redux";
import { createSelector } from "reselect";
import map from "lodash/map";
import reduce from "lodash/reduce";
import filter from "lodash/filter";
import Loading from "@components/Loading";
import ConnectedComicImage from "@components/ComicImage";

class ImageContainer extends Component<any, any> {
  render() {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center bg-comic-ink overflow-y-hidden"
        style={{
          paddingTop: this.props.paddingTop + 48,
          paddingBottom: this.props.paddingBottom,
        }}
      >
        {this.props.renderResult.length > 0 ? (
          map(this.props.renderResult, (key) => (
            <ConnectedComicImage key={key} index={key} />
          ))
        ) : (
          <Loading />
        )}
      </div>
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

const margin = 20;

const getPaddingTop = createSelector(
  (comics: any) => comics.imageList.result,
  (comics: any) => comics.imageList.entity,
  (comics: any) => comics.renderBeginIndex,
  (comics: any) => comics.innerHeight,
  (result, entity, begin, innerHeight) =>
    reduce(
      filter(result, (item) => item < begin),
      (acc, i) => {
        if (entity[i].type === "wide")
          return acc + (innerHeight - 68) + 2 * margin;
        return acc + entity[i].height + 2 * margin;
      },
      0,
    ),
);

const getPaddingBottom = createSelector(
  (comics: any) => comics.imageList.result,
  (comics: any) => comics.imageList.entity,
  (comics: any) => comics.renderEndIndex,
  (comics: any) => comics.innerHeight,
  (result, entity, end, innerHeight) =>
    reduce(
      filter(result, (item) => item > end),
      (acc, i) => {
        if (entity[i].type === "wide")
          return acc + (innerHeight - 68) + 2 * margin;
        return acc + entity[i].height + 2 * margin;
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
