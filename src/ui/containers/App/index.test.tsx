import comicsReducer from "@domain/reducers/comics";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentType } from "react";
import { connect } from "react-redux";

jest.mock("react-redux", () => ({
  connect: jest.fn(() => (Component: unknown) => Component),
}));

import App from "./index";

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
  it("links the reader title to the actual 8comic series page", () => {
    const mapStateToProps = (connect as jest.Mock).mock.calls[0][0];
    const mapped = mapStateToProps({
      comics: {
        ...comicsReducer(undefined, { type: "@@INIT" }),
        site: "8comic",
        comicsID: "105",
        title: "全職獵人",
        baseURL: "https://www.8comic.com",
        comicUrl: "https://www.8comic.com/html/105.html",
      },
    });
    render(<TestApp {...subscriptionProps()} {...mapped} />);
    expect(screen.getByRole("link", { name: "全職獵人" })).toHaveAttribute(
      "href",
      "https://www.8comic.com/html/105.html",
    );
  });
  const subscriptionProps = () => ({
    fetchChapter: jest.fn(),
    toggleSubscribe: jest.fn(),
    requestUnsubscribeSeries: jest.fn(),
    navigateChapter: jest.fn(),
    chapterTitle: "Ch 1",
    chapterList: ["c1"],
    chapterNowIndex: 0,
    title: "Demo",
    subscribe: true,
    seriesKey: "dm5:m123",
    site: "dm5",
    comicsID: "m123",
    url: "",
    clearReaderSubscriptionNotice: jest.fn(),
  });

  it.each([true, false])(
    "confirms unsubscribe with cleanup=%s and restores defaults on reopen",
    (clearSeriesData) => {
      const props = subscriptionProps();
      render(<TestApp {...props} />);
      const trigger = screen.getByRole("button", { name: "取消追蹤" });
      trigger.focus();
      fireEvent.click(trigger);
      let dialog = screen.getByRole("dialog", { name: "取消追蹤作品" });
      expect(within(dialog).getByRole("checkbox")).toBeChecked();
      expect(
        within(dialog).getByRole("button", { name: "取消" }),
      ).toHaveFocus();
      fireEvent.click(within(dialog).getByRole("checkbox"));
      fireEvent.keyDown(document, { key: "Escape" });
      expect(props.requestUnsubscribeSeries).not.toHaveBeenCalled();
      expect(trigger).toHaveFocus();
      fireEvent.click(trigger);
      dialog = screen.getByRole("dialog", { name: "取消追蹤作品" });
      expect(within(dialog).getByRole("checkbox")).toBeChecked();
      if (!clearSeriesData)
        fireEvent.click(within(dialog).getByRole("checkbox"));
      fireEvent.click(
        within(dialog).getByRole("button", { name: "確認取消追蹤" }),
      );
      expect(props.requestUnsubscribeSeries).toHaveBeenCalledTimes(1);
      expect(props.requestUnsubscribeSeries).toHaveBeenCalledWith(
        "dm5:m123",
        clearSeriesData,
      );
      expect(props.toggleSubscribe).not.toHaveBeenCalled();
    },
  );

  it("adds tracking with one click and disables requests while busy", () => {
    const props = { ...subscriptionProps(), subscribe: false };
    const { rerender } = render(<TestApp {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "追蹤作品" }));
    expect(props.toggleSubscribe).toHaveBeenCalledTimes(1);
    rerender(
      <TestApp
        {...props}
        subscriptionPending
        subscriptionNotice="取消追蹤失敗，請稍後再試。"
      />,
    );
    expect(screen.getByRole("button", { name: "追蹤作品" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("取消追蹤失敗");
  });

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
    const { container } = render(
      <TestApp
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

    expect(
      screen.getByRole("button", { name: "開啟章節列表" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一章" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下一章" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消追蹤" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "進入全螢幕" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "縮放 100%" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(
      screen.queryByRole("toolbar", { name: "圖片縮放工具" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".reader-zoom-mode")).toBeNull();
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

  it("opens and manually closes the secondary zoom toolbar", () => {
    render(
      <TestApp
        canUseSelectedReaderZoom={true}
        readerZoomPercent={90}
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

    const trigger = screen.getByRole("button", { name: "縮放 90%" });

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("toolbar", { name: "圖片縮放工具" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "關閉縮放工具" }));

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    screen.getByRole("button", { name: "關閉縮放工具" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("toolbar", { name: "圖片縮放工具" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("dispatches reader zoom actions from the header", () => {
    const adjustReaderImageScale = jest.fn();
    const resetReaderImageScale = jest.fn();
    const setReaderZoomTarget = jest.fn();

    render(
      <TestApp
        adjustReaderImageScale={adjustReaderImageScale}
        canDecreaseReaderZoom={true}
        canIncreaseReaderZoom={true}
        canUseSelectedReaderZoom={true}
        readerZoomPercent={90}
        readerZoomTarget="selected"
        resetReaderImageScale={resetReaderImageScale}
        setReaderZoomTarget={setReaderZoomTarget}
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

    fireEvent.click(screen.getByRole("button", { name: "縮放 90%" }));

    fireEvent.click(screen.getByRole("button", { name: "全部" }));
    fireEvent.click(screen.getByRole("button", { name: "縮小圖片" }));
    fireEvent.click(screen.getByRole("button", { name: "放大圖片" }));
    fireEvent.click(
      screen.getByRole("button", { name: "重設圖片縮放，目前 90%" }),
    );

    expect(setReaderZoomTarget).toHaveBeenCalledWith("all");
    expect(adjustReaderImageScale).toHaveBeenCalledWith(-0.1);
    expect(adjustReaderImageScale).toHaveBeenCalledWith(0.1);
    expect(resetReaderImageScale).toHaveBeenCalledWith("selected");
  });

  it("only fetches the initial chapter once across rerenders", () => {
    const fetchChapter = jest.fn();

    window.history.replaceState(
      {},
      "",
      "/app.html?site=dm5&chapter=chapter-1123",
    );

    const { rerender } = render(
      <TestApp
        startResize={jest.fn()}
        fetchChapter={fetchChapter}
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
        comicsID=""
        seriesKey=""
      />,
    );

    rerender(
      <TestApp
        startResize={jest.fn()}
        fetchChapter={fetchChapter}
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

    expect(fetchChapter).toHaveBeenCalledTimes(1);
    expect(fetchChapter).toHaveBeenCalledWith("chapter-1123");
  });
});
