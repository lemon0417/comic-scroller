import {
  type SyntheticEvent,
  useCallback,
  useRef,
  useState,
} from "react";
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

export function ComicImage(props: Props) {
  const {
    href,
    index,
    innerHeight,
    innerWidth,
    loading,
    renderHeight,
    renderWidth,
    src,
    type,
    updateImgType,
  } = props;
  const imageMetricsRef = useRef({ width: 0, height: 0 });
  const [state, setState] = useState<State>({
    showImage: false,
  });

  const imgLoadHandler = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    if (type === "image" && event.currentTarget) {
      const target = event.currentTarget;
      imageMetricsRef.current = {
        width: target.naturalWidth,
        height: target.naturalHeight,
      };
      const layout = getImageRenderMetrics({
        type: target.naturalWidth > target.naturalHeight ? "wide" : "natural",
        height: imageMetricsRef.current.height,
        naturalWidth: imageMetricsRef.current.width,
        naturalHeight: imageMetricsRef.current.height,
        innerWidth,
        innerHeight,
      });
      if (updateImgType && typeof index === "number") {
        updateImgType(
          layout.height,
          index,
          layout.type,
          imageMetricsRef.current.width,
          imageMetricsRef.current.height,
        );
      }
    }
    setState({ showImage: true });
  }, [index, innerHeight, innerWidth, type, updateImgType]);

  const variant = type || "init";
  const paywallHref = href || "";
  const pageStyle =
    type === "end"
      ? undefined
      : {
          width: renderWidth,
          height: renderHeight,
        };

  return (
    <div
      className={type === "end" ? "reader-end-marker" : "reader-page-surface"}
      data-variant={variant}
      style={pageStyle}
    >
      {type === "paywall" ? (
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
      {!state.showImage &&
      type !== "end" &&
      type !== "paywall" ? (
        <div className="reader-page-loading">
          <span className="text-sm font-medium text-comic-ink/45">
            Loading...
          </span>
        </div>
      ) : undefined}
      {!loading &&
      type !== "end" &&
      type !== "paywall" ? (
        <img
          style={state.showImage ? undefined : { display: "none" }}
          className="block h-full w-full object-contain"
          src={src}
          onLoad={imgLoadHandler}
          alt={String(index ?? "")}
        />
      ) : undefined}
      {type === "end" ? "本 章 結 束" : undefined}
    </div>
  );
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
