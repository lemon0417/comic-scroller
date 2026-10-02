import { initialDeveloperToolsState } from "@domain/reducers/developerTools";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";

import ManageDeveloperPanel from "./ManageDeveloperPanel";

jest.mock("@utils/buildMode", () => ({ IS_DEVELOPMENT_BUILD: true }));
jest.mock("react-redux", () => ({
  connect: () => (Component: unknown) => Component,
}));

const Panel = ManageDeveloperPanel as ComponentType<any>;
const result = {
  at: 123,
  summary: {
    checked: 3,
    updated: 1,
    errors: 1,
    diff: { before: 1, after: 3, added: 2 },
  },
};

function props(overrides = {}) {
  return {
    busy: false,
    developerTools: { ...initialDeveloperToolsState, debugReady: true },
    requestInitializeDeveloperTools: jest.fn(),
    requestSetDevLogEnabled: jest.fn(),
    requestBackgroundCheck: jest.fn(),
    ...overrides,
  };
}

describe("developer panel", () => {
  it("loads debug preferences and dispatches tool requests", () => {
    const input = props();
    render(<Panel {...input} />);
    expect(input.requestInitializeDeveloperTools).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("switch", { name: "輸出除錯記錄" }));
    expect(input.requestSetDevLogEnabled).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "執行背景檢查" }));
    expect(input.requestBackgroundCheck).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/會更新書庫/)).toBeInTheDocument();
  });

  it.each([true, false])(
    "disables scans while busy or checking (%s)",
    (busy) => {
      const input = props({
        busy,
        developerTools: {
          ...initialDeveloperToolsState,
          debugReady: true,
          checkStatus: busy ? "idle" : "running",
        },
      });
      render(<Panel {...input} />);
      const button = screen.getByRole("button", {
        name: busy ? "執行背景檢查" : "背景檢查中…",
      });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(input.requestBackgroundCheck).not.toHaveBeenCalled();
    },
  );

  it("shows partial scan results and permits another check", () => {
    render(
      <Panel
        {...props({
          developerTools: {
            ...initialDeveloperToolsState,
            debugReady: true,
            checkStatus: "success",
            checkResult: result,
          },
        })}
      />,
    );
    expect(
      screen.getByText("背景檢查完成，部分作品檢查失敗。"),
    ).toBeInTheDocument();
    expect(screen.getByText("3 部")).toBeInTheDocument();
    expect(screen.getByText("2 筆")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "執行背景檢查" })).toBeEnabled();
  });

  it("shows zero scans and inline retryable errors", () => {
    const input = props({
      developerTools: {
        ...initialDeveloperToolsState,
        debugReady: true,
        checkStatus: "success",
        checkResult: {
          ...result,
          summary: {
            checked: 0,
            updated: 0,
            errors: 0,
            diff: { before: 0, after: 0, added: 0 },
          },
        },
      },
    });
    const { rerender } = render(<Panel {...input} />);
    expect(screen.getByText("背景檢查完成。")).toBeInTheDocument();
    expect(screen.getAllByText("0 部")).toHaveLength(2);
    rerender(
      <Panel
        {...props({
          developerTools: {
            ...initialDeveloperToolsState,
            debugReady: true,
            debugError: "無法存取除錯設定",
            checkStatus: "error",
            checkError: "等待結果逾時",
          },
        })}
      />,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "執行背景檢查" })).toBeEnabled();
  });
});
