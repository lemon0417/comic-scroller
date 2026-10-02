import Button, { ButtonLink } from "@components/Button";
import ReaderStateCard from "@components/ReaderStateCard";
import {
  imageLoadFailed,
  type ReaderImageFailureStage,
  retryImage,
} from "@domain/actions/reader";
import {
  type ComicsImageRecord,
  type ComicsImageType,
  type ComicsState,
  getReaderImageScaleForImage,
  updateImgType,
} from "@domain/reducers/comics";
import { getImageRenderMetrics } from "@domain/utils/readerLayout";
import { devLog } from "@utils/devLog";
import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { connect } from "react-redux";

type Props = {
  autoRetryCount?: number;
  chapter?: string;
  href?: string;
  loadError?: ReaderImageFailureStage | null;
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
  imageScale?: number;
  index?: number;
  updateImgType?: (
    height: number,
    index: number,
    imgType: ComicsImageType,
    naturalWidth?: number,
    naturalHeight?: number,
  ) => void;
  imageLoadFailed?: (
    index: number,
    stage: ReaderImageFailureStage,
  ) => void;
  retryImage?: (index: number) => void;
};

export const IMAGE_LOAD_TIMEOUT_MS = 15000;

function getImageHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function ComicImage(props: Props) {
  const {
    autoRetryCount,
    chapter,
    href,
    index,
    innerHeight,
    innerWidth,
    loadError,
    loading,
    naturalHeight,
    naturalWidth,
    height,
    renderHeight,
    renderWidth,
    imageScale,
    retryImage: retryImageProp,
    src,
    type,
    imageLoadFailed: imageLoadFailedProp,
    updateImgType,
  } = props;
  const hasResolvedImage = Boolean(
    !loading && naturalWidth && naturalHeight,
  );
  const imageMetricsRef = useRef({ width: 0, height: 0 });
  const failureReportedRef = useRef(false);
  const [showImage, setShowImage] = useState(hasResolvedImage);

  useLayoutEffect(() => {
    imageMetricsRef.current = hasResolvedImage
      ? { width: naturalWidth || 0, height: naturalHeight || 0 }
      : { width: 0, height: 0 };
    setShowImage(hasResolvedImage);
    failureReportedRef.current = false;
  }, [hasResolvedImage, index, naturalHeight, naturalWidth, src]);

  const reportImageFailure = useCallback((stage: ReaderImageFailureStage) => {
    if (
      failureReportedRef.current ||
      !imageLoadFailedProp ||
      typeof index !== "number"
    ) {
      return;
    }
    failureReportedRef.current = true;
    devLog(stage === "image" ? "reader:image:error" : "reader:image:resolve", {
      attempt: (autoRetryCount || 0) + 1,
      chapter,
      host: getImageHost(src || ""),
      index,
      stage,
    });
    imageLoadFailedProp(index, stage);
  }, [autoRetryCount, chapter, imageLoadFailedProp, index, src]);

  useEffect(() => {
    if (
      loading ||
      showImage ||
      !src ||
      loadError ||
      type === "end" ||
      type === "paywall"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      devLog("reader:image:timeout", {
        attempt: (autoRetryCount || 0) + 1,
        chapter,
        host: getImageHost(src),
        index,
      });
      reportImageFailure("image");
    }, IMAGE_LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    autoRetryCount,
    chapter,
    index,
    loadError,
    loading,
    reportImageFailure,
    showImage,
    src,
    type,
  ]);

  const imgLoadHandler = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget) {
      const target = event.currentTarget;
      if (type === "image") {
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
          imageScale,
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
      } else if (
        updateImgType &&
        typeof index === "number" &&
        type &&
        type !== "end" &&
        type !== "paywall"
      ) {
        updateImgType(
          typeof height === "number" ? height : 0,
          index,
          type,
          naturalWidth,
          naturalHeight,
        );
      }
    }
    failureReportedRef.current = true;
    setShowImage(true);
  }, [
    height,
    index,
    innerHeight,
    innerWidth,
    imageScale,
    naturalHeight,
    naturalWidth,
    type,
    updateImgType,
  ]);

  const imgErrorHandler = useCallback(() => {
    reportImageFailure("image");
  }, [reportImageFailure]);

  const retryHandler = useCallback(() => {
    if (!retryImageProp || typeof index !== "number") {
      return;
    }
    devLog("reader:image:retry-click", {
      chapter,
      host: getImageHost(src || ""),
      index,
    });
    retryImageProp(index);
  }, [chapter, index, retryImageProp, src]);

  const variant = type || "init";
  const paywallHref = href || "";
  const isEnd = type === "end";
  const isPaywall = type === "paywall";
  const isTerminalError = Boolean(loadError) && !loading && !isEnd && !isPaywall;
  const pageStyle =
    isEnd
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
      {isPaywall ? (
        <ReaderStateCard
          title="此章節需要付費解鎖"
          description="DM5 未提供免費圖片頁面，請回原站完成購買或閱讀。"
        >
          {paywallHref ? (
            <ButtonLink
              variant="primary"
              href={paywallHref}
              target="_blank"
              rel="noreferrer"
            >
              前往 DM5 章節頁
            </ButtonLink>
          ) : undefined}
        </ReaderStateCard>
      ) : undefined}
      {isTerminalError ? (
        <ReaderStateCard title="載入失敗">
          <Button
            variant="secondary"
            onClick={retryHandler}
          >
            重試
          </Button>
        </ReaderStateCard>
      ) : undefined}
      {!showImage &&
      !isEnd &&
      !isPaywall &&
      !isTerminalError ? (
        <div className="reader-page-loading">
          <span className="text-sm font-medium text-comic-ink/50">
            Loading...
          </span>
        </div>
      ) : undefined}
      {!loading &&
      !isEnd &&
      !isPaywall &&
      !isTerminalError ? (
        <img
          style={showImage ? undefined : { display: "none" }}
          className="block h-full w-full object-contain"
          src={src}
          onLoad={imgLoadHandler}
          onError={imgErrorHandler}
          alt={String(index ?? "")}
        />
      ) : undefined}
      {isEnd ? "本 章 結 束" : undefined}
    </div>
  );
}

function createFallbackImageRecord(): ComicsImageRecord {
  return {
    autoRetryCount: 0,
    chapter: "",
    href: "",
    loadError: null,
    requestSrc: "",
    src: "",
    loading: true,
    height: 0,
    naturalHeight: 0,
    naturalWidth: 0,
    type: "image",
  };
}

function makeMapStateToProps() {
  return function mapStateToProps(
    { comics }: { comics: ComicsState },
    { index }: { index: number },
  ) {
    const {
      chapter,
      href,
      src,
      loadError,
      autoRetryCount,
      loading,
      type,
      height,
      naturalWidth,
      naturalHeight,
    } = comics.imageList.entity[index] || createFallbackImageRecord();
    const imageScale = getReaderImageScaleForImage(comics, index);
    const layout = getImageRenderMetrics({
      type,
      height,
      naturalWidth,
      naturalHeight,
      innerWidth: comics.innerWidth,
      innerHeight: comics.innerHeight,
      imageScale,
    });

    return {
      src,
      chapter,
      autoRetryCount,
      href,
      loadError,
      loading,
      type,
      height,
      naturalWidth,
      naturalHeight,
      innerHeight: comics.innerHeight,
      innerWidth: comics.innerWidth,
      renderHeight: layout.height,
      renderWidth: layout.width,
      imageScale,
    };
  };
}

export default connect(makeMapStateToProps, {
  imageLoadFailed,
  retryImage,
  updateImgType,
})(ComicImage);
