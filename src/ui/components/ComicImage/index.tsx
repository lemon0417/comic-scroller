import { Component, type SyntheticEvent } from "react";
import { connect } from "react-redux";
import { updateImgType } from "@domain/reducers/comics";
import { getImageRenderMetrics } from "@domain/utils/readerLayout";

type Props = {
  loading?: boolean;
  src?: string;
  type?: string;
  height?: number;
  innerHeight?: number;
  innerWidth?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  renderHeight?: number;
  renderWidth?: number;
  index?: number;
  updateImgType?: Function;
};

type State = {
  showImage: boolean;
};

export class ComicImage extends Component<Props, State> {
  w = 0;
  h = 0;

  state = {
    showImage: false,
  };

  imgLoadHandler = (e: SyntheticEvent<HTMLImageElement>) => {
    if (this.props.type === "image" && e.currentTarget) {
      const target = e.currentTarget;
      this.w = target.naturalWidth;
      this.h = target.naturalHeight;
      const layout = getImageRenderMetrics({
        type: target.naturalWidth > target.naturalHeight ? "wide" : "natural",
        height: this.h,
        naturalWidth: this.w,
        naturalHeight: this.h,
        innerWidth: this.props.innerWidth,
        innerHeight: this.props.innerHeight,
      });
      this.props.updateImgType &&
        this.props.updateImgType(
          layout.height,
          this.props.index,
          layout.type,
          this.w,
          this.h,
        );
    }
    this.setState({ showImage: true });
  };

  render() {
    const variant = this.props.type || "init";
    const pageStyle =
      this.props.type === "end"
        ? undefined
        : {
            width: this.props.renderWidth,
            height: this.props.renderHeight,
          };

    return (
      <div
        className={
          this.props.type === "end"
            ? "reader-end-marker"
            : "reader-page-surface"
        }
        data-variant={variant}
        style={pageStyle}
      >
        {!this.state.showImage && this.props.type !== "end" ? (
          <div className="reader-page-loading">
            <span className="text-sm font-medium text-comic-ink/45">
              Loading...
            </span>
          </div>
        ) : undefined}
        {!this.props.loading && this.props.type !== "end" ? (
          <img
            style={this.state.showImage ? undefined : { display: "none" }}
            className="block h-full w-full object-contain"
            src={this.props.src}
            onLoad={this.imgLoadHandler}
            alt={String(this.props.index ?? "")}
          />
        ) : undefined}
        {this.props.type === "end" ? "本 章 結 束" : undefined}
      </div>
    );
  }
}

function makeMapStateToProps(_state: any, props: any) {
  const { index } = props;
  return function mapStateToProps({ comics }: any) {
    const {
      src,
      loading,
      type,
      height,
      naturalWidth,
      naturalHeight,
    } = comics.imageList.entity[index];
    const layout = getImageRenderMetrics({
      type,
      height,
      naturalWidth,
      naturalHeight,
      innerWidth: comics.innerWidth,
      innerHeight: comics.innerHeight,
    });

    return {
      src,
      loading,
      type,
      height,
      naturalWidth,
      naturalHeight,
      innerHeight: comics.innerHeight,
      innerWidth: comics.innerWidth,
      renderHeight: layout.height,
      renderWidth: layout.width,
    };
  };
}

export default connect(makeMapStateToProps, {
  updateImgType,
})(ComicImage);
