import type { ComicsImageType } from "@domain/reducers/comics";
import { getImageRenderMetrics } from "@domain/utils/readerLayout";
import { fireEvent, render } from "@testing-library/react";

import { ComicImage } from ".";

type ComicImageTestProps = {
  chapter?: string;
  height: number;
  href?: string;
  index: number;
  innerHeight: number;
  innerWidth: number;
  loading: boolean;
  renderHeight?: number;
  renderWidth?: number;
  src: string;
  type?: ComicsImageType;
  updateImgType: jest.Mock;
};

const defaultProps: ComicImageTestProps = {
  loading: false,
  src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  height: 0,
  innerHeight: 0,
  innerWidth: 0,
  index: 0,
  updateImgType: jest.fn(),
};

function renderComicImage(overrideProps: Partial<ComicImageTestProps> = {}) {
  const props = { ...defaultProps, ...overrideProps };
  return render(<ComicImage {...props} />);
}

describe("ComicImage type variant check", () => {
  it("ComicImage type = undefined => data-variant = init", () => {
    const { container } = renderComicImage();
    expect(container.firstChild).toHaveAttribute("data-variant", "init");
  });

  it("ComicImage type = image => data-variant = image", () => {
    const { container } = renderComicImage({ type: "image" });
    expect(container.firstChild).toHaveAttribute("data-variant", "image");
  });

  it("ComicImage type = wide => data-variant = wide", () => {
    const { container } = renderComicImage({ type: "wide" });
    expect(container.firstChild).toHaveAttribute("data-variant", "wide");
  });

  it("ComicImage type = natural => data-variant = natural", () => {
    const { container } = renderComicImage({ type: "natural" });
    expect(container.firstChild).toHaveAttribute("data-variant", "natural");
  });
});

describe("ComicImage Loading controls", () => {
  it("contain Loading when init", () => {
    const { getByText } = renderComicImage();
    expect(getByText("Loading...")).toBeInTheDocument();
  });

  it("state { showImage: true } hidding Loading", () => {
    const { container, queryByText } = renderComicImage();
    const img = container.querySelector("img");
    if (!img) throw new Error("expected img element");
    fireEvent.load(img);
    expect(queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("updates image metrics from viewport-aware sizing", () => {
    const updateImgType = jest.fn();
    const { container } = renderComicImage({
      type: "image",
      innerWidth: 1280,
      innerHeight: 900,
      updateImgType,
    });
    const img = container.querySelector("img");
    if (!img) throw new Error("expected img element");
    Object.defineProperty(img, "naturalWidth", {
      value: 1200,
      configurable: true,
    });
    Object.defineProperty(img, "naturalHeight", {
      value: 1800,
      configurable: true,
    });

    fireEvent.load(img);

    const layout = getImageRenderMetrics({
      type: "natural",
      height: 1800,
      naturalWidth: 1200,
      naturalHeight: 1800,
      innerWidth: 1280,
      innerHeight: 900,
    });

    expect(updateImgType).toHaveBeenCalledWith(
      layout.height,
      0,
      layout.type,
      1200,
      1800,
    );
  });
});

describe("ComicImage shows End", () => {
  it("ComicImage type = end => data-variant = end", () => {
    const { container } = renderComicImage({ type: "end" });
    expect(container.firstChild).toHaveAttribute("data-variant", "end");
  });

  it("show End when props { type = end }", () => {
    const { getByText } = renderComicImage({ type: "end" });
    expect(getByText("本 章 結 束")).toBeInTheDocument();
  });

  it("show End when props { type = end } state { showImage = true }", () => {
    const { getByText, queryByRole, queryByText } = renderComicImage({
      type: "end",
    });
    expect(queryByText("Loading...")).not.toBeInTheDocument();
    expect(queryByRole("img")).not.toBeInTheDocument();
    expect(getByText("本 章 結 束")).toBeInTheDocument();
  });

  it("show End when props { type = end, loading = true }", () => {
    const { getByText, queryByRole, queryByText } = renderComicImage({
      type: "end",
      loading: true,
    });
    expect(queryByText("Loading...")).not.toBeInTheDocument();
    expect(queryByRole("img")).not.toBeInTheDocument();
    expect(getByText("本 章 結 束")).toBeInTheDocument();
  });
});

describe("ComicImage shows Image", () => {
  it("contains image when props { loading = false }", () => {
    const { container } = renderComicImage({ loading: false });
    expect(container.querySelector("img")).toBeInTheDocument();
  });

  it("does not use fixed 980px reader classes", () => {
    const { container } = renderComicImage({
      type: "natural",
      renderWidth: 960,
      renderHeight: 1440,
    });

    expect(container.firstChild).not.toHaveClass("w-[980px]");
    expect(container.firstChild).not.toHaveClass("min-w-[980px]");
  });
});

describe("ComicImage shows Paywall", () => {
  it("renders a paywall card without loading state or image", () => {
    const { getByRole, getByText, queryByRole, queryByText } =
      renderComicImage({
        type: "paywall",
        loading: false,
        href: "https://www.dm5.com/m1655813/",
      });

    expect(queryByText("Loading...")).not.toBeInTheDocument();
    expect(queryByRole("img")).not.toBeInTheDocument();
    expect(getByText("此章節需要付費解鎖")).toBeInTheDocument();
    expect(getByRole("link", { name: "前往 DM5 章節頁" })).toHaveAttribute(
      "href",
      "https://www.dm5.com/m1655813/",
    );
  });
});
