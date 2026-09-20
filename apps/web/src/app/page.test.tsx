import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("HELIOS landing shell", () => {
  it("renders the product identity and placeholder roles", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Your health story matters",
    );
    expect(
      screen.getByRole("link", { name: /patient experience/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /doctor experience/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/patient journey is available/i),
    ).toBeInTheDocument();
  });
});
