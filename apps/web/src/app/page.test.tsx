import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("HELIOS landing shell", () => {
  it("offers patient entry without a doctor workspace", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Your health story matters",
    );
    expect(
      screen.getByRole("link", { name: /patient experience/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /patient experience/i })).toHaveAttribute(
      "href",
      "/patient",
    );
    expect(
      screen.queryByRole("link", { name: /doctor experience/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/start a Hindi voice conversation/i),
    ).toBeInTheDocument();
  });
});
