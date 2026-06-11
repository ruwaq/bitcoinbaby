import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardContent, CardFooter } from "../card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card body</Card>);
    expect(screen.getByText("Card body")).toBeInTheDocument();
  });

  it("applies pixel art border styles", () => {
    render(<Card>Content</Card>);
    const card = screen.getByText("Content");
    expect(card.className).toMatch(/border-4/);
    expect(card.className).toMatch(/shadow-\[8px_8px_0_0_#000/);
  });

  it("merges custom className", () => {
    render(<Card className="max-w-md">Content</Card>);
    expect(screen.getByText("Content").className).toMatch(/max-w-md/);
  });
});

describe("CardHeader", () => {
  it("renders children", () => {
    render(<CardHeader>Title</CardHeader>);
    expect(screen.getByText("Title")).toBeInTheDocument();
  });

  it("has bottom border separator", () => {
    render(<CardHeader>Title</CardHeader>);
    expect(screen.getByText("Title").className).toMatch(/border-b-2/);
  });
});

describe("CardContent", () => {
  it("renders children", () => {
    render(<CardContent>Body text</CardContent>);
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });
});

describe("CardFooter", () => {
  it("renders children", () => {
    render(<CardFooter>Footer actions</CardFooter>);
    expect(screen.getByText("Footer actions")).toBeInTheDocument();
  });

  it("has top border separator", () => {
    render(<CardFooter>Footer</CardFooter>);
    expect(screen.getByText("Footer").className).toMatch(/border-t-2/);
  });
});

describe("Card composition", () => {
  it("renders full card structure", () => {
    render(
      <Card>
        <CardHeader>Baby Status</CardHeader>
        <CardContent>Level 5 — Happy</CardContent>
        <CardFooter>
          <button>Feed</button>
        </CardFooter>
      </Card>,
    );

    expect(screen.getByText("Baby Status")).toBeInTheDocument();
    expect(screen.getByText("Level 5 — Happy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Feed" })).toBeInTheDocument();
  });
});
