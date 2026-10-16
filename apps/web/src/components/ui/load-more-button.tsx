"use client";

import { cn } from "@repo/ui/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadMoreButtonProps {
  canLoadMore: boolean;
  className?: string;
  error: boolean;
  isLoading: boolean;
  label: string;
  loadingLabel: string;
  onLoadMore: () => void;
  retryLabel: string;
}

/**
 * Shared "Load more" control for the public feeds.
 *
 * A failed page keeps the already-loaded rows on screen and turns the control
 * into a retry — never a blank grid.
 *
 * Drawn as the design system's secondary action (the outlined pill
 * `statusPanelSecondaryAction` uses), not a shadcn `Button`: it sits under a
 * card grid that is otherwise entirely redesign primitives, and the legacy
 * button reads the old palette.
 */
export function LoadMoreButton({
  canLoadMore,
  className,
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
    <div className={cn("mt-10 flex flex-col items-center gap-3", className)}>
      {error ? (
        <p className="type-body-sm text-danger" role="alert">
          {retryLabel}
        </p>
      ) : null}
      <button
        aria-busy={isLoading}
        className="type-label inline-flex min-w-48 items-center justify-center gap-2 rounded-biso-pill border border-edge px-6 py-3 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-wait disabled:opacity-70"
        disabled={isLoading}
        onClick={onLoadMore}
        type="button"
      >
        {isLoading ? (
          <>
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          label
        )}
      </button>
    </div>
  );
}
