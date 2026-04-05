import { act, fireEvent, render, screen } from "@testing-library/react";
import IconButton from "./index";

describe("IconButton", () => {
  it("renders an accessible button and fires click handlers", () => {
    const onClickHandler = jest.fn();

    render(
      <IconButton ariaLabel="開啟選單" onClickHandler={onClickHandler}>
        <span>icon</span>
      </IconButton>,
    );

    fireEvent.click(screen.getByRole("button", { name: "開啟選單" }));

    expect(onClickHandler).toHaveBeenCalledTimes(1);
  });

  it("does not fire click or mouse down handlers when disabled", () => {
    const onClickHandler = jest.fn();
    const onMouseDownHandler = jest.fn();

    render(
      <IconButton
        ariaLabel="開啟選單"
        disabled
        onClickHandler={onClickHandler}
        onMouseDownHandler={onMouseDownHandler}
      >
        <span>icon</span>
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "開啟選單" });
    fireEvent.mouseDown(button);
    fireEvent.click(button);

    expect(onMouseDownHandler).not.toHaveBeenCalled();
    expect(onClickHandler).not.toHaveBeenCalled();
  });

  it("renders and cleans up ripple nodes on mouse down", () => {
    jest.useFakeTimers();

    const { container } = render(
      <IconButton ariaLabel="開啟選單">
        <span>icon</span>
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "開啟選單" });
    button.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 40,
      height: 40,
      right: 40,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as typeof button.getBoundingClientRect;

    fireEvent.mouseDown(button, { pageX: 10, pageY: 10 });

    expect(
      container.querySelector(".pointer-events-none.absolute"),
    ).toBeInTheDocument();

    fireEvent.mouseUp(document);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(
      container.querySelector(".pointer-events-none.absolute"),
    ).not.toBeInTheDocument();

    jest.useRealTimers();
  });
});
