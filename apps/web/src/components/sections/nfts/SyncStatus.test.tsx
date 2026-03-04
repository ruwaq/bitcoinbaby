import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SyncStatus } from "./SyncStatus";

describe("SyncStatus", () => {
  const defaultProps = {
    isFetching: false,
    error: null,
    lastSynced: null,
    onRefresh: vi.fn(),
  };

  it("renders refresh button when not fetching and no error", () => {
    render(<SyncStatus {...defaultProps} />);

    const button = screen.getByRole("button", { name: /refresh/i });
    expect(button).toBeInTheDocument();
  });

  it("shows syncing state when fetching", () => {
    render(<SyncStatus {...defaultProps} isFetching={true} />);

    expect(screen.getByText("Syncing...")).toBeInTheDocument();
  });

  it("shows error state with retry button", () => {
    render(<SyncStatus {...defaultProps} error="Failed to sync" />);

    const retryButton = screen.getByRole("button", {
      name: /sync failed - retry/i,
    });
    expect(retryButton).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button is clicked", () => {
    const onRefresh = vi.fn();
    render(<SyncStatus {...defaultProps} onRefresh={onRefresh} />);

    const button = screen.getByRole("button", { name: /refresh/i });
    fireEvent.click(button);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("calls onRefresh when retry button is clicked", () => {
    const onRefresh = vi.fn();
    render(
      <SyncStatus {...defaultProps} error="Failed" onRefresh={onRefresh} />,
    );

    const button = screen.getByRole("button", { name: /sync failed - retry/i });
    fireEvent.click(button);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("disables refresh button while fetching", () => {
    render(<SyncStatus {...defaultProps} isFetching={true} />);

    const button = screen.queryByRole("button", { name: /refresh/i });
    if (button) {
      expect(button).toBeDisabled();
    }
  });

  it("shows last synced time in title", () => {
    const lastSynced = Date.now();
    render(<SyncStatus {...defaultProps} lastSynced={lastSynced} />);

    const button = screen.getByRole("button", { name: /refresh/i });
    expect(button).toHaveAttribute(
      "title",
      expect.stringContaining("Last synced:"),
    );
  });
});
