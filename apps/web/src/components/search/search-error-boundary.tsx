"use client";

import { Component, type ReactNode } from "react";
import { searchPageHref } from "@/lib/search/page-params";

const SENTRY_FLUSH_MS = 500;
/** Never keep the visitor waiting on reporting. */
const REPORT_CAP_MS = 800;

/**
 * Reports the error to Sentry. Loaded on demand, like the root error page, so
 * a missing Sentry module cannot break this fallback. Only the error goes: no
 * context, since the query is what the visitor typed.
 */
async function reportError(error: unknown): Promise<void> {
  try {
    const { captureException, flush } = await import("@sentry/nextjs");
    captureException(error);
    // The page is about to be replaced; give the event a moment to leave.
    await flush(SENTRY_FLUSH_MS);
  } catch {
    // Sentry is unavailable; search still falls back to the full page.
  }
}

interface SearchErrorBoundaryProps {
  children?: ReactNode;
  /** Closes search in the header. */
  onClose: () => void;
  /** What the visitor had typed, if anything survived. */
  readQuery: () => string;
}

interface SearchErrorBoundaryState {
  failed: boolean;
}

/**
 * Keeps a broken quick search inside the header. The quick search is a lazy
 * chunk; if it fails to load (a deploy swapped the chunks, the network
 * dropped) or throws, the error would otherwise climb past the header to the
 * global error page, and `React.lazy` keeps the rejection, so reopening
 * fails the same way. Instead search closes and the full search page loads,
 * with the query when one was typed.
 */
export class SearchErrorBoundary extends Component<
  SearchErrorBoundaryProps,
  SearchErrorBoundaryState
> {
  state: SearchErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SearchErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    const href = searchPageHref({ q: this.props.readQuery() });
    this.props.onClose();
    const cap = new Promise<void>((resolve) =>
      setTimeout(resolve, REPORT_CAP_MS)
    );
    Promise.race([reportError(error), cap]).then(() =>
      window.location.assign(href)
    );
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
