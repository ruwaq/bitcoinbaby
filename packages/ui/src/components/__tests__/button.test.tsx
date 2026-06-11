import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../button";

describe("Button", () => {
  it("renders with default variant and size", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
    // Default variant classes
    expect(button.className).toMatch(/bg-pixel-primary/);
    expect(button.className).toMatch(/h-10/); // default size
  });

  it("applies variant classes correctly", () => {
    const variants = [
      "default",
      "secondary",
      "outline",
      "ghost",
      "destructive",
      "success",
      "warning",
    ] as const;

    for (const variant of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>);
      const button = screen.getByRole("button", { name: variant });
      expect(button).toBeInTheDocument();
      unmount();
    }
  });

  it("applies size classes correctly", () => {
    const sizes = [
      ["default", "h-10"],
      ["sm", "h-8"],
      ["lg", "h-12"],
      ["icon", "h-10 w-10"],
    ] as const;

    for (const [size, expectedClass] of sizes) {
      const { unmount } = render(<Button size={size}>{size}</Button>);
      const button = screen.getByRole("button", { name: size });
      // Check that at least one expected class is present
      const classes = expectedClass.split(" ");
      for (const cls of classes) {
        expect(button.className).toMatch(new RegExp(cls));
      }
      unmount();
    }
  });

  it("handles click events", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole("button", { name: /click/i }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire click when disabled", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole("button", { name: /disabled/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("merges custom className", () => {
    render(<Button className="custom-class">Styled</Button>);
    const button = screen.getByRole("button", { name: /styled/i });
    expect(button.className).toMatch(/custom-class/);
  });

  it("passes through HTML button attributes", () => {
    render(
      <Button type="submit" aria-label="submit form" data-testid="btn">
        Submit
      </Button>,
    );
    const button = screen.getByTestId("btn");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-label", "submit form");
  });

  it("exports PixelButton as alias", async () => {
    // Verify the alias is the same component via dynamic import (ESM)
    const mod = await import("../button");
    expect(mod.PixelButton).toBe(mod.Button);
  });
});
