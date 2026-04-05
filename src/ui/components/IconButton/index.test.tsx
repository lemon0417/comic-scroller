import { fireEvent, render, screen } from "@testing-library/react";
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
});
