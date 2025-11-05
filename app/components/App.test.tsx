import { expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { App } from "./App";

it("renders hello", async () => {
  render(<App />);

  const hours = within(screen.getByTestId("hello"));
  expect(hours.getByText("Hello")).toBeDefined();
});
