import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/renderer/App";

describe("App", () => {
  it("renders the app shell", () => {
    render(<App />);

    expect(screen.getByText("Agent Hub")).toBeInTheDocument();
  });
});
