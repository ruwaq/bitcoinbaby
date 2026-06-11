import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText("Enter text");
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("defaults to type text", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("type", "text");
  });

  it("accepts different input types", () => {
    const types = ["email", "password", "number", "search"] as const;
    for (const type of types) {
      const { unmount } = render(<Input type={type} placeholder={type} />);
      expect(screen.getByPlaceholderText(type)).toHaveAttribute("type", type);
      unmount();
    }
  });

  it("handles user input", async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Type here" />);

    const input = screen.getByPlaceholderText("Type here");
    await user.type(input, "hello");

    expect(input).toHaveValue("hello");
  });

  it("handles onChange callback", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<Input onChange={handleChange} />);
    await user.type(screen.getByRole("textbox"), "a");

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("applies disabled state", () => {
    render(<Input disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText("Disabled")).toBeDisabled();
  });

  it("applies pixel art border styles", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input.className).toMatch(/border-4/);
    expect(input.className).toMatch(/border-pixel-border/);
  });

  it("merges custom className", () => {
    render(<Input className="custom-input" />);
    expect(screen.getByRole("textbox").className).toMatch(/custom-input/);
  });

  it("forwards ref correctly", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("passes through aria attributes", () => {
    render(<Input aria-label="search" aria-required="true" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-label", "search");
    expect(input).toHaveAttribute("aria-required", "true");
  });
});
