import { render, screen } from "@testing-library/react";
import SeriesRow from "./index";

describe("SeriesRow", () => {
  it("renders an action icon as decorative SVG with a text button label", () => {
    render(
      <SeriesRow
        title="作品標題"
        siteLabel="DM5"
        summary="最新章節：第 1 話"
        actions={[
          {
            icon: "arrow",
            label: "繼續",
            variant: "primary",
          },
        ]}
      />,
    );

    const button = screen.getByRole("button", { name: "繼續" });
    expect(button).toBeInTheDocument();
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the title as an external link when titleHref is provided", () => {
    render(
      <SeriesRow
        title="作品標題"
        titleHref="https://example.com/series"
        siteLabel="DM5"
        summary="最新章節：第 1 話"
      />,
    );

    const link = screen.getByRole("link", { name: "作品標題" });
    expect(link).toHaveAttribute("href", "https://example.com/series");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("keeps plain text actions without rendering an icon", () => {
    render(
      <SeriesRow
        title="作品標題"
        siteLabel="DM5"
        summary="最新章節：第 1 話"
        actions={[
          {
            label: "管理",
          },
        ]}
      />,
    );

    const button = screen.getByRole("button", { name: "管理" });
    expect(button).toBeInTheDocument();
    expect(button.querySelector("svg")).not.toBeInTheDocument();
  });

  it("applies an explicit popup variant class", () => {
    const { container } = render(
      <SeriesRow
        variant="popup"
        title="作品標題"
        siteLabel="DM5"
        summary="最新章節：第 1 話"
      />,
    );

    expect(container.querySelector(".series-row")).toHaveClass("series-row--popup");
  });
});
