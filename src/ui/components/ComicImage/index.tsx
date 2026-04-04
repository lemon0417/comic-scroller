import { Component, type SyntheticEvent } from "react";
import { connect } from "react-redux";
import {
  type ComicsImageRecord,
  type ComicsImageType,
  type ComicsState,
  updateImgType,
} from "@domain/reducers/comics";
import { getImageRenderMetrics } from "@domain/utils/readerLayout";

type Props = {
  chapter?: string;
  href?: string;
  loading?: boolean;
  src?: string;
  type?: ComicsImageType;
  height?: number;
  innerHeight?: number;
  innerWidth?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  renderHeight?: number;
  renderWidth?: number;
  index?: number;
  updateImgType?: (
    height: number,
    index: number,
    imgType: ComicsImageType,
    naturalWidth?: number,
    naturalHeight?: number,
  ) => void;
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
      if (this.props.updateImgType && typeof this.props.index === "number") {
        this.props.updateImgType(
          layout.height,
          this.props.index,
          layout.type,
          this.w,
          this.h,
        );
      }
    }
    this.setState({ showImage: true });
  };

  render() {
    const variant = this.props.type || "init";
    const paywallHref = this.props.href || "";
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
        {this.props.type === "paywall" ? (
          <div className="reader-paywall-card">
            <p className="reader-paywall-title">此章節需要付費解鎖</p>
            <p className="reader-paywall-desc">
              DM5 未提供免費圖片頁面，請回原站完成購買或閱讀。
            </p>
            {paywallHref ? (
              <a
                className="ds-btn-primary"
                href={paywallHref}
                target="_blank"
                rel="noreferrer"
              >
                前往 DM5 章節頁
              </a>
            ) : undefined}
          </div>
        ) : undefined}
        {!this.state.showImage &&
        this.props.type !== "end" &&
        this.props.type !== "paywall" ? (
          <div className="reader-page-loading">
            <span className="text-sm font-medium text-comic-ink/45">
              Loading...
            </span>
          </div>
        ) : undefined}
        {!this.props.loading &&
        this.props.type !== "end" &&
        this.props.type !== "paywall" ? (
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

function createFallbackImageRecord(): ComicsImageRecord {
  return {
    chapter: "",
    href: "",
    src: "",
    loading: true,
    height: 0,
    naturalHeight: 0,
    naturalWidth: 0,
    type: "image",
  };
}

function makeMapStateToProps(
  _state: { comics: ComicsState },
  props: { index: number },
) {
  const { index } = props;
  return function mapStateToProps({ comics }: { comics: ComicsState }) {
    const {
      chapter,
      href,
      src,
      loading,
      type,
      height,
      naturalWidth,
      naturalHeight,
    } = comics.imageList.entity[index] || createFallbackImageRecord();
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
      chapter,
      href,
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
