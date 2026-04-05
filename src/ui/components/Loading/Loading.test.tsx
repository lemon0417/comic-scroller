import { render } from "@testing-library/react";

import Loading from "./index";

test("Loading contains circle svg", () => {
  const { container, getByText } = render(<Loading />);
  const circle = container.querySelector("svg circle");
  expect(circle).toBeInTheDocument();
  expect(circle).toHaveAttribute("cx", "22");
  expect(circle).toHaveAttribute("cy", "22");
  expect(circle).toHaveAttribute("r", "18");
  expect(getByText("載入中...")).toBeInTheDocument();
});

test("Loading snapshot", () => {
  const { asFragment } = render(<Loading />);
  expect(asFragment()).toMatchSnapshot();
});
