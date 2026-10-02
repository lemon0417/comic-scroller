import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";

import ConnectedComicImage from ".";

function createImageRecord(src: string) {
  return {
    autoRetryCount: 0,
    chapter: "c1",
    height: 1600,
    loadError: null,
    loading: false,
    naturalHeight: 1600,
    naturalWidth: 900,
    requestSrc: src,
    src,
    type: "natural",
  };
}

describe("ConnectedComicImage", () => {
  it("selects the current image record when a virtual row is reused", () => {
    const store = createStore(() => ({
      comics: {
        imageList: {
          result: [10, 12],
          entity: {
            10: createImageRecord("https://example.com/10.jpg"),
            12: createImageRecord("https://example.com/12.jpg"),
          },
        },
        imageScaleOverrides: {},
        innerHeight: 900,
        innerWidth: 1200,
        readerGlobalScale: 1,
      },
    }));
    const { container, rerender } = render(
      <Provider store={store}>
        <ConnectedComicImage index={10} />
      </Provider>,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/10.jpg",
    );

    rerender(
      <Provider store={store}>
        <ConnectedComicImage index={12} />
      </Provider>,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/12.jpg",
    );
  });
});
