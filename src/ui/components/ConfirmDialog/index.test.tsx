import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import ConfirmDialog from "./index";

function DialogHarness({
  busy = false,
}: {
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        開啟對話框
      </button>
      <ConfirmDialog
        open={open}
        title="刪除作品"
        description="確定要刪除這部作品嗎？"
        confirmLabel="確認刪除"
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      >
        <button type="button">次要操作</button>
      </ConfirmDialog>
    </div>
  );
}

describe("ConfirmDialog", () => {
  it("renders through a portal and focuses the cancel button on open", () => {
    const { container } = render(<DialogHarness />);

    expect(container).not.toContainElement(
      screen.queryByRole("dialog", { name: "刪除作品" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "開啟對話框" }));

    expect(screen.getByRole("dialog", { name: "刪除作品" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
    expect(container).not.toContainElement(
      screen.getByRole("dialog", { name: "刪除作品" }),
    );
  });

  it("traps focus within the dialog when tabbing past the ends", () => {
    render(<DialogHarness />);

    fireEvent.click(screen.getByRole("button", { name: "開啟對話框" }));

    const firstFocusable = screen.getByRole("button", { name: "次要操作" });
    const confirmButton = screen.getByRole("button", { name: "確認刪除" });

    confirmButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(firstFocusable).toHaveFocus();

    firstFocusable.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(confirmButton).toHaveFocus();
  });

  it("returns focus to the trigger when the dialog closes", () => {
    render(<DialogHarness />);

    const trigger = screen.getByRole("button", { name: "開啟對話框" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("dialog", { name: "刪除作品" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape and backdrop clicks", () => {
    render(<DialogHarness />);

    fireEvent.click(screen.getByRole("button", { name: "開啟對話框" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "刪除作品" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "開啟對話框" }));
    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.queryByRole("dialog", { name: "刪除作品" })).not.toBeInTheDocument();
  });

  it("does not close on Escape or backdrop clicks while busy", () => {
    render(<DialogHarness busy />);

    fireEvent.click(screen.getByRole("button", { name: "開啟對話框" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "刪除作品" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("presentation"));
    expect(screen.getByRole("dialog", { name: "刪除作品" })).toBeInTheDocument();
  });
});
