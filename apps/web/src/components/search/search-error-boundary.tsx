"use client";

import { Component, type ReactNode } from "react";

/** `/search` for the trimmed query, or the bare page when there is none. */
export function searchPageHref(query: string): string {
  const q = query.trim();
  return q ? `/search?${new URLSearchParams({ q }).toString()}` : "/search";
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

  componentDidCatch(): void {
    const href = searchPageHref(this.props.readQuery());
    this.props.onClose();
    window.location.assign(href);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
