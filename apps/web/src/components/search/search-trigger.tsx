"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Ref } from "react";

/**
 * The ids the triggers point at. They live here, not in the lazily loaded
 * quick search, so the header can name them without loading that code.
 */
export const SEARCH_PANEL_ID = "nav-panel-search";
export const SEARCH_SHEET_ID = "search-sheet";

export interface SearchTriggerProps {
  /** The id of the panel or sheet this trigger opens. */
  controls: string;
  expanded: boolean;
  onOpen: () => void;
  triggerRef: Ref<HTMLButtonElement>;
}

/** The header's search icon button, sized like the cart beside it. */
export function SearchTrigger({
  controls,
  expanded,
  onOpen,
  triggerRef,
}: SearchTriggerProps) {
  const t = useTranslations("search");
  return (
    <button
      aria-controls={expanded ? controls : undefined}
      aria-expanded={expanded}
      aria-keyshortcuts="/ Control+K Meta+K"
      aria-label={t("open")}
      className="relative shrink-0 rounded-biso-md p-2 text-ink transition-colors hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      onClick={onOpen}
      ref={triggerRef}
      type="button"
    >
      <Search aria-hidden="true" className="size-5" />
    </button>
  );
}
