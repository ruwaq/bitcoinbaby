import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MenuButton } from "./MenuButton";
import type { MenuItem } from "./data";

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

// Mock pixelShadows and pixelBorders
vi.mock("@bitcoinbaby/ui", () => ({
  pixelShadows: {
    md: "shadow-md",
    smHover: "hover:shadow-sm",
  },
  pixelBorders: {
    medium: "border-4",
  },
}));

describe("MenuButton", () => {
  const mockItem: MenuItem = {
    id: "test",
    label: "Test Item",
    description: "Test description",
    icon: "🧪",
    href: "/test",
  };

  it("renders menu item with label and description", () => {
    render(<MenuButton item={mockItem} />);

    expect(screen.getByText("Test Item")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByText("🧪")).toBeInTheDocument();
  });

  it("renders as internal link by default", () => {
    render(<MenuButton item={mockItem} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/test");
  });

  it("renders as external link when external is true", () => {
    const externalItem: MenuItem = {
      ...mockItem,
      href: "https://example.com",
      external: true,
    };

    render(<MenuButton item={externalItem} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders as button when onClick is provided", () => {
    const onClick = vi.fn();
    const clickItem: MenuItem = {
      ...mockItem,
      onClick,
    };

    render(<MenuButton item={clickItem} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies highlight styles when highlight is true", () => {
    const highlightItem: MenuItem = {
      ...mockItem,
      highlight: true,
    };

    render(<MenuButton item={highlightItem} />);

    const label = screen.getByText("Test Item");
    expect(label).toHaveClass("text-pixel-primary");
  });
});
