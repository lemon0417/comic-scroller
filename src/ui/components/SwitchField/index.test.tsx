import { fireEvent, render, screen } from "@testing-library/react";

import SwitchField from "./index";

describe("SwitchField", () => {
  it("renders switch semantics and calls onToggle", () => {
    const onToggle = jest.fn();

    render(
      <SwitchField
        id="manage-debug-log-toggle"
        label="除錯記錄"
        description="輸出 Redux action 與解析 trace 到 console。"
        checked={false}
        onToggle={onToggle}
      />,
    );

    const switchControl = screen.getByRole("switch", { name: "除錯記錄" });
    expect(switchControl).toHaveAttribute("aria-checked", "false");
    expect(switchControl).toHaveAttribute(
      "aria-describedby",
      "manage-debug-log-desc",
    );

    fireEvent.click(switchControl);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders checked and disabled states", () => {
    render(
      <SwitchField
        id="manage-debug-log-toggle"
        label="除錯記錄"
        description="輸出 Redux action 與解析 trace 到 console。"
        checked
        disabled
        onToggle={jest.fn()}
      />,
    );

    const switchControl = screen.getByRole("switch", { name: "除錯記錄" });
    expect(switchControl).toHaveAttribute("aria-checked", "true");
    expect(switchControl).toBeDisabled();
  });
});
