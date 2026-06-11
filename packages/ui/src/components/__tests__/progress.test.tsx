import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Progress } from "../progress";

describe("Progress", () => {
  it("renders with default props", () => {
    render(<Progress value={50} />);
    // The bar should have width 50%
    const bar = document.querySelector(".bg-pixel-primary");
    expect(bar).toBeInTheDocument();
    expect(bar?.getAttribute("style")).toMatch(/width:\s*50%/);
  });

  it("clamps value between 0 and max", () => {
    const { unmount } = render(<Progress value={150} max={100} />);
    let bar = document.querySelector(".bg-pixel-primary");
    expect(bar?.getAttribute("style")).toMatch(/width:\s*100%/);
    unmount();

    const { unmount: u2 } = render(<Progress value={-10} max={100} />);
    bar = document.querySelector(".bg-pixel-primary");
    expect(bar?.getAttribute("style")).toMatch(/width:\s*0%/);
    u2();
  });

  it("renders different variants", () => {
    const variants = [
      "default",
      "success",
      "warning",
      "error",
      "mining",
    ] as const;

    for (const variant of variants) {
      const { unmount } = render(<Progress value={30} variant={variant} />);
      // Each variant should render a bar
      const bar = document.querySelector("[style*='width']");
      expect(bar).toBeInTheDocument();
      unmount();
    }
  });

  it("shows label when showLabel is true", () => {
    render(<Progress value={75} showLabel />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("hides label by default", () => {
    render(<Progress value={75} />);
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
  });

  it("uses custom max value", () => {
    render(<Progress value={5} max={10} showLabel />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("merges custom className", () => {
    render(<Progress value={20} className="my-4" />);
    const container = document.querySelector(".my-4");
    expect(container).toBeInTheDocument();
  });
});
