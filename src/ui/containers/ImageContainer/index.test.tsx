import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";

jest.mock("react-redux", () => ({
  connect: () => (Component: unknown) => Component,
}));

import ImageContainer from "./index";

jest.mock("@components/ComicImage", () => ({
  __esModule: true,
  default: ({ index }: { index: number }) => (
    <div data-testid={`comic-image-${index}`}>{index}</div>
  ),
}));

type ImageContainerProps = {
  imageListKey: string;
  imageResult: number[];
  innerHeight: number;
  updateVisibleImageRange: jest.Mock;
};

const TestImageContainer = ImageContainer as unknown as ComponentType<ImageContainerProps>;

describe("ImageContainer", () => {
  it("renders a loading state when no images are available", () => {
    render(
      <TestImageContainer
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
      <TestImageContainer
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
