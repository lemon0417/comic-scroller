import { render, screen } from "@testing-library/react";

import LoadingRows from "./index";

describe("LoadingRows", () => {
  it("renders standalone loading row classes without using manage variants", () => {
    const { container } = render(<LoadingRows count={2} />);

    expect(screen.getByLabelText("載入中")).toBeInTheDocument();
    expect(container.querySelectorAll(".loading-series-row")).toHaveLength(2);
    expect(container.querySelector(".series-row--manage")).not.toBeInTheDocument();
  });
});
