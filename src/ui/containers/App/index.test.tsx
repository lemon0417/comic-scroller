import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";

jest.mock("react-redux", () => ({
  connect: () => (Component: unknown) => Component,
}));

import App from "./index";

jest.mock("@infra/services/library/reader", () => ({
  getReaderSeriesSyncState: jest.fn(async () => ({
    exists: true,
    subscribed: true,
  })),
  subscribeToLibrarySignal: jest.fn(() => () => undefined),
}));

jest.mock("@containers/ImageContainer", () => ({
  __esModule: true,
  default: () => <div data-testid="image-container" />,
}));

jest.mock("@containers/ChapterList", () => ({
  __esModule: true,
  default: () => <div data-testid="chapter-list" />,
}));

const TestApp = App as unknown as ComponentType<any>;

describe("App", () => {
  beforeEach(() => {
    (global as any).chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn(),
        },
      },
      tabs: {
        getCurrent: jest.fn(),
        remove: jest.fn(),
      },
    };
    window.history.replaceState({}, "", "/app.html");
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => null,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: jest.fn(() => Promise.resolve()),
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: jest.fn(() => Promise.resolve()),
    });
  });

  it("renders accessible reader header controls", () => {
    const startResize = jest.fn();

    render(
      <TestApp
        startResize={startResize}
        fetchChapter={jest.fn()}
        updateSubscribe={jest.fn()}
        toggleSubscribe={jest.fn()}
        navigateChapter={jest.fn()}
        prevable={true}
        nextable={false}
        chapterTitle="Ch 1123"
        chapterList={["chapter-1123"]}
        title="One Piece"
        subscribe={true}
        url="https://dm5.com/one-piece"
        chapterNowIndex={0}
        site="dm5"
        comicsID="123"
        seriesKey="dm5:m123"
      />,
    );

    expect(startResize).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "開啟章節列表" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "上一章" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "下一章" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "取消追蹤" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "進入全螢幕" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "One Piece" })).toHaveAttribute(
      "href",
      "https://dm5.com/one-piece",
    );
    expect(screen.getByText("Ch 1123")).toBeInTheDocument();
  });

  it("toggles fullscreen from the reader header", async () => {
    const requestFullscreen = jest.fn(() => Promise.resolve());

    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });

    render(
      <TestApp
        startResize={jest.fn()}
        fetchChapter={jest.fn()}
        updateSubscribe={jest.fn()}
        toggleSubscribe={jest.fn()}
        navigateChapter={jest.fn()}
        prevable={true}
        nextable={true}
        chapterTitle="Ch 1123"
        chapterList={["chapter-1123"]}
        title="One Piece"
        subscribe={false}
        url="https://dm5.com/one-piece"
        chapterNowIndex={0}
        site="dm5"
        comicsID="123"
        seriesKey="dm5:m123"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "進入全螢幕" }));

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
