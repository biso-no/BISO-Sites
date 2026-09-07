"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Loader2 } from "lucide-react";

interface LoadMoreButtonProps {
  canLoadMore: boolean;
  error: boolean;
  isLoading: boolean;
  label: string;
  loadingLabel: string;
  onLoadMore: () => void;
  retryLabel: string;
}

/**
 * Shared "Load more" control for the public list grids.
 *
 * A failed page keeps the already-loaded rows on screen and turns the control
 * into a retry — never a blank grid.
 */
export function LoadMoreButton({
  canLoadMore,
  error,
  isLoading,
  label,
  loadingLabel,
  onLoadMore,
  retryLabel,
}: LoadMoreButtonProps) {
  // `isLoading` keeps the control mounted mid-request: canLoadMore is false
  // while a page is in flight, and hiding the button then would make it
  // flicker out and back on every click.
  if (!(canLoadMore || isLoading)) {
    return null;
  }

  return (
    <div className="mt-12 flex flex-col items-center gap-3">
      {error && (
        <p className="text-muted-foreground text-sm" role="alert">
          {retryLabel}
        </p>
      )}
      <Button
        className="min-w-48"
        disabled={isLoading}
        onClick={onLoadMore}
        size="lg"
        variant="outline"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          label
        )}
      </Button>
    </div>
  );
}
