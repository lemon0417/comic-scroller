import { render, screen } from "@testing-library/react";
import { ImageContainer } from "./index";

jest.mock("@components/ComicImage", () => ({
  __esModule: true,
  default: ({ index }: { index: number }) => (
    <div data-testid={`comic-image-${index}`}>{index}</div>
  ),
}));

describe("ImageContainer", () => {
  it("renders a loading state when no images are available", () => {
    render(
      <ImageContainer
        imageListKey="reader-list"
        imageResult={[]}
        innerHeight={900}
        updateVisibleImageRange={jest.fn()}
      />,
    );

    expect(screen.getByText("載入中...")).toBeInTheDocument();
  });

  it("virtualizes image rows and reports the visible range", () => {
    const updateVisibleImageRange = jest.fn();
    const imageResult = Array.from({ length: 200 }, (_, index) => index);

    render(
      <ImageContainer
        imageListKey="m1"
        imageResult={imageResult}
        innerHeight={900}
        updateVisibleImageRange={updateVisibleImageRange}
      />,
    );

    expect(screen.getAllByTestId(/^comic-image-/).length).toBeLessThan(
      imageResult.length,
    );
    expect(updateVisibleImageRange).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
    );
  });
});
