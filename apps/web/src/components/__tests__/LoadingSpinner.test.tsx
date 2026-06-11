/**
 * Tests for LoadingSpinner component
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingSpinner } from "../shared/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("should render with default size", () => {
    render(<LoadingSpinner />);
    const spinner = screen.getByRole("status");
    expect(spinner).toBeInTheDocument();
  });

  it("should render with custom size", () => {
    render(<LoadingSpinner size="lg" />);
    const spinner = screen.getByRole("status");
    expect(spinner).toBeInTheDocument();
  });

  it("should render with custom label", () => {
    render(<LoadingSpinner label="Loading wallet..." />);
    expect(screen.getByText("Loading wallet...")).toBeInTheDocument();
  });

  it("should apply custom className to container", () => {
    render(<LoadingSpinner className="my-custom-class" />);
    const spinner = screen.getByRole("status");
    // className is applied to the container div, not the spinner itself
    expect(spinner.parentElement?.className).toContain("my-custom-class");
  });
});
