"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { campusIdToSegment } from "@repo/shared/utils/unit-urls";
import { cn } from "@repo/ui/lib/utils";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { MegaPanel } from "@/components/nav/mega-panel";
import {
  HEADER_CONTAINER_CLASS,
  HEADER_LOGO_WIDTH_CLASS,
} from "@/components/nav/nav-config";
import { rememberSearch } from "@/lib/search/recent";
import {
  QUICK_SEARCH_LISTBOX_ID,
  type QuickOption,
  quickOptions,
  searchHref,
} from "./quick-options";
import { QuickSearchInput } from "./quick-search-input";
import { QuickSearchResults } from "./quick-search-results";
import { SEARCH_PANEL_ID, SEARCH_SHEET_ID } from "./search-trigger";
import { shownResponse, useQuickSearch } from "./use-quick-search";

type Layout = "panel" | "sheet";

export interface QuickSearchProps {
  campusId: string | null;
  layout: Layout;
  locale: "no" | "en";
  onClose: () => void;
}

/** The field and its icon; the input draws no ring, so this box shows focus. */
const FIELD_CLASS =
  "flex min-w-0 items-center gap-3 rounded-biso-md focus-within:ring-2 focus-within:ring-focus-ring";
const KBD_CLASS =
  "rounded-biso-sm border border-edge bg-surface-raised px-1.5 py-0.5 font-bold text-ink-muted text-xs";

/** API routes (document downloads) are not app pages: load them in full. */
function isApiRoute(href: string): boolean {
  return href.startsWith("/api/");
}

/** The option the arrow key lands on, wrapping at both ends. */
function stepThrough(
  options: QuickOption[],
  activeId: string | null,
  step: 1 | -1
): string {
  const index = options.findIndex((option) => option.id === activeId);
  if (index === -1) {
    return (step === 1 ? options[0] : options.at(-1))?.id ?? "";
  }
  return options[(index + step + options.length) % options.length]?.id ?? "";
}

/**
 * The quick search, loaded on open: the field, the results, the keys and the
 * ways out. On the desktop (`panel`) the field is drawn over the header row
 * from the logo's right edge and the results drop below the bar in the mega
 * panel shell; on a phone (`sheet`) both fill the screen. The panel renders
 * inside the header's `<nav>`, so the header's outside-click check counts it
 * as inside; the sheet covers everything and keeps focus itself.
 *
 * Escape closes from anywhere while it is open. Navigation goes through
 * `router.push`, except API routes, which need a full page load.
 */
export default function QuickSearch({
  campusId,
  layout,
  locale,
  onClose,
}: QuickSearchProps) {
  const t = useTranslations("search");
  const router = useRouter();
  const { query, setQuery, state } = useQuickSearch({
    campus: campusId,
    locale,
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  // One id per layout, so the panel and the sheet can never share one.
  const listboxId = `${QUICK_SEARCH_LISTBOX_ID}-${layout}`;
  const campusSlug = campusIdToSegment(campusId);

  const response = shownResponse(state);
  const options = useMemo(
    () => (response ? quickOptions(response, query) : []),
    [response, query]
  );
  // An option from an answer that is no longer on screen is not active.
  const active = options.some((option) => option.id === activeId)
    ? activeId
    : null;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // The sheet covers the page: the page must not scroll under it, and focus
  // must not wander to controls hidden behind it.
  useEffect(() => {
    if (layout !== "sheet") {
      return;
    }
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const handleFocusIn = (event: FocusEvent) => {
      const sheet = sheetRef.current;
      if (sheet && !sheet.contains(event.target as Node | null)) {
        inputRef.current?.focus();
      }
    };
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      body.style.overflow = previousOverflow;
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [layout]);

  const navigate = useCallback(
    (href: string) => {
      const q = query.trim();
      // The quick links open before anything is typed: not a search.
      if (q) {
        rememberSearch(q);
        trackEvent("search", {
          surface: layout === "panel" ? "quick" : "quick-mobile",
          queryLength: q.length,
        });
      }
      if (isApiRoute(href)) {
        window.location.assign(href);
      } else {
        router.push(href);
      }
      onCloseRef.current();
    },
    [layout, query, router]
  );

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      setActiveId(null);
    },
    [setQuery]
  );

  const pickQuery = useCallback(
    (value: string) => {
      handleChange(value);
      inputRef.current?.focus();
    },
    [handleChange]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) {
        return;
      }
      event.preventDefault();
      setActiveId(
        stepThrough(options, active, event.key === "ArrowDown" ? 1 : -1)
      );
      return;
    }
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }
    const option = options.find((candidate) => candidate.id === active);
    if (option) {
      event.preventDefault();
      navigate(option.href);
    } else if (query.trim()) {
      event.preventDefault();
      navigate(searchHref(query));
    }
  };

  const input = (className: string) => (
    <QuickSearchInput
      activeId={active}
      className={className}
      expanded={options.length > 0}
      inputRef={inputRef}
      listboxId={listboxId}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      value={query}
    />
  );
  const results = (
    <QuickSearchResults
      activeId={active}
      campusSlug={campusSlug}
      layout={layout}
      listboxId={listboxId}
      onNavigate={navigate}
      onPickQuery={pickQuery}
      query={query}
      state={state}
    />
  );

  if (layout === "sheet") {
    // On the page's body, not in the header: the header is its own stacking
    // context, so inside it the sheet could not rise above the page's other
    // fixed layers (the onboarding card, the app banner).
    return createPortal(
      <div
        aria-label={t("field.label")}
        aria-modal="true"
        className="fixed inset-0 z-[60] flex flex-col bg-surface text-ink"
        data-surface="deep"
        id={SEARCH_SHEET_ID}
        ref={sheetRef}
        role="dialog"
      >
        <div className="shrink-0 border-edge border-b px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                FIELD_CLASS,
                "h-12 flex-1 border border-edge bg-surface-raised px-3"
              )}
            >
              <Search
                aria-hidden="true"
                className="size-5 shrink-0 text-ink-accent"
              />
              {input("text-lg")}
            </div>
            <button
              className="type-body-sm shrink-0 rounded-biso-sm px-1 py-2 font-bold text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={onClose}
              type="button"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {results}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <>
      {/* Over the header row, from the logo's right edge to the container's.
          The row and its measuring ghost stay mounted underneath; only the
          bar takes pointer events, so the logo stays a link. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
        <div className={cn(HEADER_CONTAINER_CLASS, "flex h-20 gap-4")}>
          <div
            aria-hidden="true"
            className={cn(HEADER_LOGO_WIDTH_CLASS, "shrink-0")}
          />
          <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-4 border-edge border-l bg-surface pl-5">
            <div className={cn(FIELD_CLASS, "flex-1 px-2 py-1.5")}>
              <Search
                aria-hidden="true"
                className="size-6 shrink-0 text-ink-accent"
              />
              {input("text-[1.6rem] leading-tight")}
            </div>
            <span aria-hidden="true" className="shrink-0">
              <kbd className={KBD_CLASS}>Esc</kbd>
            </span>
            <button
              aria-label={t("close")}
              className="grid size-9 shrink-0 place-items-center rounded-biso-md border border-edge text-ink transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <MegaPanel
        ariaLabel={t("open")}
        className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain"
        id={SEARCH_PANEL_ID}
      >
        {results}
      </MegaPanel>
    </>
  );
}
