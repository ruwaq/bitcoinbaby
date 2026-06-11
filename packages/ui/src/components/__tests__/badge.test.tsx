import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "../badge";

describe("Badge", () => {
  it("renders with default variant", () => {
    render(<Badge>Status</Badge>);
    const badge = screen.getByText("Status");
    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe("SPAN");
    expect(badge.className).toMatch(/bg-pixel-primary/);
  });

  it("renders baby state variants", () => {
    const states = [
      "sleeping",
      "hungry",
      "happy",
      "learning",
      "evolving",
    ] as const;

    for (const state of states) {
      const { unmount } = render(<Badge variant={state}>{state}</Badge>);
      expect(screen.getByText(state)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders mining state variants", () => {
    const { unmount: u1 } = render(<Badge variant="mining">Mining</Badge>);
    expect(screen.getByText("Mining")).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(<Badge variant="idle">Idle</Badge>);
    expect(screen.getByText("Idle")).toBeInTheDocument();
    u2();
  });

  it("applies size variants", () => {
    const { unmount: u1 } = render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText("Small").className).toMatch(/text-\[6px\]/);
    u1();

    const { unmount: u2 } = render(<Badge size="lg">Large</Badge>);
    expect(screen.getByText("Large").className).toMatch(/text-\[10px\]/);
    u2();
  });

  it("merges custom className", () => {
    render(<Badge className="ml-2">Custom</Badge>);
    expect(screen.getByText("Custom").className).toMatch(/ml-2/);
  });

  it("passes through HTML attributes", () => {
    render(
      <Badge id="status-badge" aria-label="baby status">
        Online
      </Badge>,
    );
    const badge = screen.getByText("Online");
    expect(badge).toHaveAttribute("id", "status-badge");
    expect(badge).toHaveAttribute("aria-label", "baby status");
  });
});
