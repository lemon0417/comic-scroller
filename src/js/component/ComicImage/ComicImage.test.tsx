import { fireEvent, render } from "@testing-library/react";
import { ComicImage } from ".";

const defaultProps = {
  loading: false,
  src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  type: "",
  height: 0,
  innerHeight: 0,
  index: 0,
  updateImgType: () => {},
};

function renderComicImage(overrideProps: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrideProps };
  return render(<ComicImage {...props} />);
}

describe("ComicImage type variant check", () => {
  it("ComicImage type = undefined => data-variant = init", () => {
    const { container } = renderComicImage({ type: "" });
    expect(container.firstChild).toHaveAttribute("data-variant", "init");
  });

  it("ComicImage type = normal => data-variant = normal", () => {
    const { container } = renderComicImage({ type: "normal" });
    expect(container.firstChild).toHaveAttribute("data-variant", "normal");
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
});
