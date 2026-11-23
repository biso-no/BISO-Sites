"use client";

import type {
  QuickSearchResponse,
  SearchHit,
} from "@repo/shared/search/response";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight, History } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { clearRecentSearches, readRecentSearches } from "@/lib/search/recent";
import { Highlighted } from "./highlighted";
import { HitLead } from "./hit-lead";
import { hitMeta, intlLocaleOf, type SearchTranslate } from "./hit-meta";
import {
  optionDomId,
  QUICK_SEARCH_LISTBOX_ID,
  type QuickSection,
  SHOW_ALL_OPTION_ID,
  searchHref,
  sectionsOf,
} from "./quick-options";
import { type QuickSearchState, shownResponse } from "./use-quick-search";

// Named beside the results in the brief. The input imports quick-options
// directly, so it never pulls these views in.
export {
  QUICK_SEARCH_LISTBOX_ID,
  type QuickOption,
  quickOptions,
} from "./quick-options";

type Layout = "panel" | "sheet";

/** What every option needs: which one is active, its listbox, and where clicks go. */
interface OptionScope {
  activeId: string | null;
  listboxId: string;
  onNavigate: (href: string) => void;
}

/** Let the browser handle new-tab clicks; a plain click goes through `onNavigate`. */
function plainClick(onNavigate: (href: string) => void, href: string) {
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onNavigate(href);
  };
}

const HEADING_CLASS = "type-label text-ink-muted";
const ROW_CLASS =
  "-mx-2 flex items-center gap-2 rounded-biso-sm px-2 py-2 type-body-sm text-ink transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";
/** The active option shows the focus ring: keyboard focus stays in the field. */
const ACTIVE_CLASS =
  "aria-selected:bg-surface-raised aria-selected:ring-2 aria-selected:ring-focus-ring";
const LINK_CLASS =
  "inline-flex items-center gap-2 rounded-biso-sm type-body-sm font-bold text-ink-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";
/** The best match keeps its column even alone, so its picture stays card-sized. */
const PANEL_GRID_WITH_BEST = "lg:grid-cols-[18rem_minmax(0,1fr)]";

function OptionLink({
  children,
  className,
  href,
  id,
  scope,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  id: string;
  scope: OptionScope;
}) {
  return (
    <a
      aria-selected={scope.activeId === id}
      className={cn("transition-colors", ACTIVE_CLASS, className)}
      href={href}
      id={optionDomId(scope.listboxId, id)}
      onClick={plainClick(scope.onNavigate, href)}
      role="option"
      tabIndex={-1}
    >
      {children}
    </a>
  );
}

/**
 * A labelled set of options inside the listbox (the APG grouped listbox). The
 * label is presentational text the group points at, not a heading.
 */
function OptionGroup({
  children,
  count,
  label,
}: {
  children: ReactNode;
  count?: number;
  label: string;
}) {
  const labelId = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: an option group inside a listbox is ARIA `group`; <fieldset> groups form controls
    <div aria-labelledby={labelId} role="group">
      <div
        className="mb-1 flex items-baseline gap-2 border-edge border-b pb-2"
        id={labelId}
        role="presentation"
      >
        <span className={HEADING_CLASS}>{label}</span>
        {count === undefined ? null : (
          <span className="type-data ml-auto text-ink-muted">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-biso-sm border border-edge bg-surface-raised px-1.5 py-0.5 font-bold text-ink-muted text-xs">
      {children}
    </kbd>
  );
}

function KeyHints({ t }: { t: SearchTranslate }) {
  return (
    <div
      aria-hidden="true"
      className="type-body-sm flex flex-wrap items-center gap-4 text-ink-muted"
    >
      <span className="inline-flex items-center gap-1.5">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        {t("hints.move")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Kbd>↵</Kbd>
        {t("hints.open")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Kbd>Esc</Kbd>
        {t("hints.close")}
      </span>
    </div>
  );
}

function BestMatch({
  best,
  layout,
  locale,
  scope,
  t,
}: {
  best: SearchHit;
  layout: Layout;
  locale: string;
  scope: OptionScope;
  t: SearchTranslate;
}) {
  const meta = hitMeta(best, locale, t);
  const hasSnippet = best.snippet.some((segment) => segment.text.trim());

  if (layout === "sheet") {
    return (
      <OptionGroup label={t("best")}>
        <OptionLink
          className="mt-2 flex items-center gap-3 rounded-biso-md bg-surface-raised p-3 focus-visible:outline-none"
          href={best.url}
          id={best.id}
          scope={scope}
        >
          <HitLead hit={best} locale={locale} size="small" />
          <span className="min-w-0 flex-1">
            <Highlighted
              className="line-clamp-2 font-bold font-display text-base text-ink leading-snug"
              segments={best.title}
            />
            {meta ? (
              <span className="mt-0.5 block truncate text-ink-muted text-xs">
                {meta}
              </span>
            ) : null}
          </span>
        </OptionLink>
      </OptionGroup>
    );
  }

  return (
    <OptionGroup label={t("best")}>
      <OptionLink
        className="mt-2 flex w-full max-w-72 flex-col items-start gap-3 rounded-biso-md bg-surface-raised p-4 focus-visible:outline-none"
        href={best.url}
        id={best.id}
        scope={scope}
      >
        <HitLead hit={best} locale={locale} size="large" />
        <Highlighted
          className="line-clamp-3 font-black font-display text-ink text-xl leading-tight"
          segments={best.title}
        />
        {meta ? (
          <span className="type-body-sm -mt-1 block text-ink-muted">
            {meta}
          </span>
        ) : null}
        {hasSnippet ? (
          <Highlighted
            className="type-body-sm line-clamp-2 text-ink-muted"
            segments={best.snippet}
          />
        ) : null}
      </OptionLink>
    </OptionGroup>
  );
}

function GroupList({
  locale,
  scope,
  section,
  t,
}: {
  locale: string;
  scope: OptionScope;
  section: QuickSection;
  t: SearchTranslate;
}) {
  return (
    <OptionGroup count={section.count} label={t(`groups.${section.group}`)}>
      {section.hits.map((hit) => {
        const meta = hitMeta(hit, locale, t);
        return (
          <OptionLink
            className="-mx-2 block rounded-biso-sm px-2 py-2 hover:bg-surface-raised focus-visible:outline-none"
            href={hit.url}
            id={hit.id}
            key={hit.id}
            scope={scope}
          >
            <Highlighted
              className="type-body-sm line-clamp-2 font-bold text-ink"
              segments={hit.title}
            />
            {meta ? (
              <span className="mt-0.5 block truncate text-ink-muted text-xs">
                {meta}
              </span>
            ) : null}
          </OptionLink>
        );
      })}
    </OptionGroup>
  );
}

function ResultsList({
  layout,
  query,
  response,
  scope,
}: {
  layout: Layout;
  query: string;
  response: QuickSearchResponse;
  scope: OptionScope;
}) {
  const t = useTranslations("search");
  const locale = intlLocaleOf(response.locale);
  const sections = sectionsOf(response);
  const best = response.best;
  const isPanel = layout === "panel";

  const bestMatch = best ? (
    <BestMatch
      best={best}
      layout={layout}
      locale={locale}
      scope={scope}
      t={t}
    />
  ) : null;
  const groups = sections.map((section) => (
    <GroupList
      key={section.group}
      locale={locale}
      scope={scope}
      section={section}
      t={t}
    />
  ));

  return (
    <div aria-label={t("field.label")} id={scope.listboxId} role="listbox">
      {isPanel ? (
        <div className={cn("grid gap-8", best && PANEL_GRID_WITH_BEST)}>
          {bestMatch}
          {groups.length > 0 ? (
            <div className="grid content-start gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {groups}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {bestMatch}
          {groups}
        </div>
      )}
      <div
        className={cn(
          "mt-6 border-edge border-t pt-4",
          isPanel && "flex flex-wrap items-center justify-between gap-4"
        )}
      >
        <OptionLink
          className={cn(
            LINK_CLASS,
            "px-2 py-1.5",
            isPanel ? "-mx-2" : "w-full justify-center py-3"
          )}
          href={searchHref(query)}
          id={SHOW_ALL_OPTION_ID}
          scope={scope}
        >
          {/* The count belongs to the answer on screen, so it names that
              answer's query; the link follows what is typed now. */}
          {t("showAll", { count: response.total, query: response.query })}
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </OptionLink>
        {isPanel ? <KeyHints t={t} /> : null}
      </div>
    </div>
  );
}

function IdleContent({
  campusSlug,
  layout,
  onNavigate,
  onPickQuery,
}: {
  campusSlug: string | null;
  layout: Layout;
  onNavigate: (href: string) => void;
  onPickQuery: (q: string) => void;
}) {
  const t = useTranslations("search");
  const baseId = useId();
  // Only ever rendered in the browser (the quick search is not server-rendered),
  // so reading storage in the initializer cannot cause a hydration mismatch.
  const [recent, setRecent] = useState<string[]>(() => readRecentSearches());
  const eventsHref = campusSlug
    ? `/events?${new URLSearchParams({ campus: campusSlug }).toString()}`
    : "/events";
  const shortcuts = [
    { href: eventsHref, label: t("shortcuts.events") },
    { href: "/jobs", label: t("shortcuts.jobs") },
    { href: "/shop", label: t("shortcuts.shop") },
  ];

  return (
    <div className={cn("grid gap-8", layout === "panel" && "sm:grid-cols-2")}>
      {recent.length > 0 ? (
        <section aria-labelledby={`${baseId}-recent`}>
          <div className="mb-1 flex items-baseline gap-2 border-edge border-b pb-2">
            <h3 className={HEADING_CLASS} id={`${baseId}-recent`}>
              {t("recent.title")}
            </h3>
            <button
              className={cn(LINK_CLASS, "ml-auto")}
              onClick={() => {
                clearRecentSearches();
                setRecent([]);
              }}
              type="button"
            >
              {t("recent.clear")}
            </button>
          </div>
          <ul>
            {recent.map((item) => (
              <li key={item}>
                <button
                  className={cn(ROW_CLASS, "w-[calc(100%+1rem)] text-left")}
                  onClick={() => onPickQuery(item)}
                  type="button"
                >
                  <History
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ink-muted"
                  />
                  <span className="min-w-0 truncate">{item}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby={`${baseId}-shortcuts`}>
        <h3
          className={cn(HEADING_CLASS, "mb-1 border-edge border-b pb-2")}
          id={`${baseId}-shortcuts`}
        >
          {t("shortcuts.title")}
        </h3>
        <ul>
          {shortcuts.map((shortcut) => (
            <li key={shortcut.href}>
              <a
                className={ROW_CLASS}
                href={shortcut.href}
                onClick={plainClick(onNavigate, shortcut.href)}
              >
                <span className="min-w-0 flex-1">{shortcut.label}</span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-ink-muted"
                />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function EmptyContent({
  onNavigate,
  query,
}: {
  onNavigate: (href: string) => void;
  query: string;
}) {
  const t = useTranslations("search");
  const links: { href: string; label: string }[] = [
    { href: "/events", label: t("groups.event") },
    { href: "/news", label: t("groups.news") },
    { href: "/jobs", label: t("groups.job") },
  ];
  return (
    <div className="max-w-xl">
      <p className="font-bold font-display text-ink text-lg">
        {t("empty.title", { query })}
      </p>
      <p className="type-body-sm mt-1 text-ink-muted">{t("empty.body")}</p>
      <p className={cn(HEADING_CLASS, "mt-5")}>{t("empty.links")}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <a
              className="type-body-sm inline-flex rounded-biso-pill border border-edge px-3 py-1.5 font-bold text-ink transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              href={link.href}
              onClick={plainClick(onNavigate, link.href)}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorContent({
  onNavigate,
  query,
}: {
  onNavigate: (href: string) => void;
  query: string;
}) {
  const t = useTranslations("search");
  const href = searchHref(query);
  return (
    <div className="max-w-xl">
      <p className="font-bold font-display text-ink text-lg">
        {t("error.title")}
      </p>
      <p className="type-body-sm mt-1 text-ink-muted">{t("error.body")}</p>
      {query.trim() ? (
        <a
          className={cn(LINK_CLASS, "mt-4")}
          href={href}
          onClick={plainClick(onNavigate, href)}
        >
          {t("error.link")}
          <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </a>
      ) : null}
    </div>
  );
}

export interface QuickSearchResultsProps {
  activeId: string | null;
  campusSlug: string | null;
  layout: Layout;
  /** Must match the input's `listboxId`; option DOM ids are scoped by it. */
  listboxId?: string;
  onNavigate: (href: string) => void;
  /** A recent search was picked: put it in the field. */
  onPickQuery: (q: string) => void;
  query: string;
  state: QuickSearchState;
}

/**
 * The quick-search body under the field: recent searches and shortcuts before
 * typing, then the best match and grouped results (a 3-column grid on the
 * desktop panel, stacked on the phone sheet), the empty and error states, and
 * a polite live region with the result count. Sits on navy.
 */
export function QuickSearchResults({
  activeId,
  campusSlug,
  layout,
  listboxId = QUICK_SEARCH_LISTBOX_ID,
  onNavigate,
  onPickQuery,
  query,
  state,
}: QuickSearchResultsProps) {
  const t = useTranslations("search");
  const response = shownResponse(state);

  useEffect(() => {
    if (activeId) {
      document
        .getElementById(optionDomId(listboxId, activeId))
        ?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeId, listboxId]);

  let announcement = "";
  if (response) {
    announcement = t("resultsCount", { count: response.total });
  } else if (state.status === "error") {
    announcement = t("error.title");
  }

  let body: ReactNode = null;
  if (state.status === "idle") {
    body = (
      <IdleContent
        campusSlug={campusSlug}
        layout={layout}
        onNavigate={onNavigate}
        onPickQuery={onPickQuery}
      />
    );
  } else if (state.status === "error") {
    body = <ErrorContent onNavigate={onNavigate} query={query} />;
  } else if (response && response.total === 0) {
    body = <EmptyContent onNavigate={onNavigate} query={response.query} />;
  } else if (response) {
    body = (
      <ResultsList
        layout={layout}
        query={query}
        response={response}
        scope={{ activeId, listboxId, onNavigate }}
      />
    );
  } else {
    // First search still loading: hold the space instead of flashing content.
    body = <div aria-hidden="true" className="h-24" />;
  }

  return (
    <div className="text-ink" data-surface="deep">
      <p aria-atomic="true" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {body}
    </div>
  );
}
