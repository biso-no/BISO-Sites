"use client";

import {
  type QuickSearchResponse,
  SEARCH_GROUPS,
  type SearchGroup,
  type SearchHit,
} from "@repo/shared/search/response";
import { ALL_CAMPUSES } from "@repo/shared/search/types";
import { formatOsloDate } from "@repo/shared/utils/oslo-time";
import { ImageWithFallback } from "@repo/ui/components/image";
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
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { DateBlock } from "@/components/ui/date-block";
import { clearRecentSearches, readRecentSearches } from "@/lib/search/recent";
import { Highlighted } from "./highlighted";
import { type QuickSearchState, shownResponse } from "./use-quick-search";

export const QUICK_SEARCH_LISTBOX_ID = "quick-search-listbox";
/** The option id of the "Show all N results" row. */
export const SHOW_ALL_OPTION_ID = "show-all";

/** The DOM id of an option, for `aria-activedescendant`. */
export function optionDomId(id: string): string {
  return `quick-search-option-${id}`;
}

export interface QuickOption {
  href: string;
  id: string;
}

interface QuickSection {
  count: number;
  group: SearchGroup;
  hits: SearchHit[];
}

type Translate = ReturnType<typeof useTranslations>;
type Layout = "panel" | "sheet";

const PATH_END = /[?#]/;
const META_SEPARATOR = " · ";
const MS_PER_SECOND = 1000;

/** `/search?q=…` for the trimmed query. */
function searchHref(query: string): string {
  return `/search?${new URLSearchParams({ q: query.trim() }).toString()}`;
}

/** The groups that have rows to show, in SEARCH_GROUPS order. */
function sectionsOf(response: QuickSearchResponse): QuickSection[] {
  const bestId = response.best?.id;
  return SEARCH_GROUPS.flatMap((group) => {
    const hits = response.groups[group].filter((hit) => hit.id !== bestId);
    return hits.length > 0
      ? [{ count: response.counts[group], group, hits }]
      : [];
  });
}

/**
 * Every selectable row in display order: the best match, the groups in
 * SEARCH_GROUPS order, then "Show all". Arrow keys walk this list; nothing is
 * selectable when nothing matched.
 */
export function quickOptions(
  response: QuickSearchResponse,
  query: string
): QuickOption[] {
  if (response.total === 0) {
    return [];
  }
  const options: QuickOption[] = [];
  if (response.best) {
    options.push({ href: response.best.url, id: response.best.id });
  }
  for (const section of sectionsOf(response)) {
    for (const hit of section.hits) {
      options.push({ href: hit.url, id: hit.id });
    }
  }
  options.push({ href: searchHref(query), id: SHOW_ALL_OPTION_ID });
  return options;
}

function dateLocaleOf(response: QuickSearchResponse): string {
  return response.locale === "no" ? "nb-NO" : "en-GB";
}

function joinMeta(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(META_SEPARATOR);
}

function formatSeconds(
  seconds: number | null,
  options: Intl.DateTimeFormatOptions,
  locale: string
): string | null {
  return seconds === null
    ? null
    : formatOsloDate(new Date(seconds * MS_PER_SECOND), options, locale);
}

function productMeta(hit: SearchHit, locale: string, t: Translate): string {
  const money = new Intl.NumberFormat(locale, {
    currency: "NOK",
    maximumFractionDigits: 0,
    style: "currency",
  });
  let member: string | null = null;
  if (hit.member_price === 0) {
    member = t("meta.freeForMembers");
  } else if (
    hit.member_price !== null &&
    hit.price !== null &&
    hit.member_price < hit.price
  ) {
    member = t("meta.membersFrom", { price: money.format(hit.member_price) });
  }
  // Buyers see in stock / out of stock only, never a count.
  return joinMeta([
    hit.price === null ? null : money.format(hit.price),
    member,
    hit.in_stock === false ? t("meta.outOfStock") : null,
  ]);
}

/** One short line under a result title: when, where, price or path. */
function hitMeta(hit: SearchHit, locale: string, t: Translate): string {
  const campus = hit.campus_id === ALL_CAMPUSES ? null : hit.campus_name;
  switch (hit.group) {
    case "event":
      return joinMeta([
        formatSeconds(
          hit.starts_at,
          { day: "numeric", month: "short", weekday: "short" },
          locale
        ),
        hit.location ?? campus,
      ]);
    case "news":
      return joinMeta([
        formatSeconds(
          hit.published_at,
          { day: "numeric", month: "short", year: "numeric" },
          locale
        ),
        campus,
      ]);
    case "job": {
      const deadline = formatSeconds(
        hit.deadline,
        { day: "numeric", month: "short" },
        locale
      );
      return joinMeta([
        deadline ? t("meta.applyBy", { date: deadline }) : null,
        hit.department ?? campus,
      ]);
    }
    case "product":
      return productMeta(hit, locale, t);
    case "page": {
      // A document's URL is its download route, which says nothing useful.
      if (hit.type === "document") {
        return joinMeta([hit.department, campus]);
      }
      // Where the page sits: its parent path ("projects / winter-games").
      const parents = hit.url
        .split(PATH_END)[0]
        .split("/")
        .filter(Boolean)
        .slice(0, -1);
      return parents.length > 0 ? parents.join(" / ") : (campus ?? "");
    }
    default:
      return hit.campus_name;
  }
}

type LeadKind = "date" | "image" | null;

/** Events lead with their date, news and products with their picture; nothing else gets a lead visual. */
function leadOf(hit: SearchHit): LeadKind {
  if (hit.group === "event" && hit.starts_at !== null) {
    return "date";
  }
  const pictured =
    hit.group === "event" || hit.group === "news" || hit.group === "product";
  return pictured && hit.image ? "image" : null;
}

function Lead({
  hit,
  locale,
  size,
}: {
  hit: SearchHit;
  locale: string;
  size: "large" | "small";
}) {
  const kind = leadOf(hit);
  if (kind === "date" && hit.starts_at !== null) {
    return (
      <DateBlock
        date={new Date(hit.starts_at * MS_PER_SECOND)}
        locale={locale}
      />
    );
  }
  if (kind === "image" && hit.image) {
    const large = size === "large";
    return (
      <ChevronFrame
        className={cn(
          "shrink-0 bg-surface-sunken",
          large ? "mb-1 w-full" : "w-16"
        )}
        ratio={large ? "16/9" : "4/3"}
      >
        {/* `alt=""`: the title next to it is the option's name. */}
        <ImageWithFallback
          alt=""
          height={large ? 324 : 96}
          sizes={large ? "288px" : "64px"}
          src={hit.image}
          width={large ? 576 : 128}
        />
      </ChevronFrame>
    );
  }
  return null;
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

function OptionLink({
  activeId,
  children,
  className,
  href,
  id,
  onNavigate,
}: {
  activeId: string | null;
  children: ReactNode;
  className?: string;
  href: string;
  id: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <a
      aria-selected={activeId === id}
      className={cn("transition-colors", ACTIVE_CLASS, className)}
      href={href}
      id={optionDomId(id)}
      onClick={plainClick(onNavigate, href)}
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

function KeyHints({ t }: { t: Translate }) {
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

interface ResultsProps {
  activeId: string | null;
  busy: boolean;
  layout: Layout;
  listboxId: string;
  onNavigate: (href: string) => void;
  query: string;
  response: QuickSearchResponse;
}

function BestMatch({
  activeId,
  best,
  layout,
  locale,
  onNavigate,
  t,
}: {
  activeId: string | null;
  best: SearchHit;
  layout: Layout;
  locale: string;
  onNavigate: (href: string) => void;
  t: Translate;
}) {
  const meta = hitMeta(best, locale, t);
  const hasSnippet = best.snippet.some((segment) => segment.text.trim());

  if (layout === "sheet") {
    return (
      <OptionGroup label={t("best")}>
        <OptionLink
          activeId={activeId}
          className="mt-2 flex items-center gap-3 rounded-biso-md bg-surface-raised p-3 focus-visible:outline-none"
          href={best.url}
          id={best.id}
          onNavigate={onNavigate}
        >
          <Lead hit={best} locale={locale} size="small" />
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
        activeId={activeId}
        className="mt-2 flex flex-col items-start gap-3 rounded-biso-md bg-surface-raised p-4 focus-visible:outline-none"
        href={best.url}
        id={best.id}
        onNavigate={onNavigate}
      >
        <Lead hit={best} locale={locale} size="large" />
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
  activeId,
  locale,
  onNavigate,
  section,
  t,
}: {
  activeId: string | null;
  locale: string;
  onNavigate: (href: string) => void;
  section: QuickSection;
  t: Translate;
}) {
  return (
    <OptionGroup count={section.count} label={t(`groups.${section.group}`)}>
      {section.hits.map((hit) => {
        const meta = hitMeta(hit, locale, t);
        return (
          <OptionLink
            activeId={activeId}
            className="-mx-2 block rounded-biso-sm px-2 py-2 hover:bg-surface-raised focus-visible:outline-none"
            href={hit.url}
            id={hit.id}
            key={hit.id}
            onNavigate={onNavigate}
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
  activeId,
  busy,
  layout,
  listboxId,
  onNavigate,
  query,
  response,
}: ResultsProps) {
  const t = useTranslations("search");
  const locale = dateLocaleOf(response);
  const sections = sectionsOf(response);
  const best = response.best;
  const isPanel = layout === "panel";

  const groups = sections.map((section) => (
    <GroupList
      activeId={activeId}
      key={section.group}
      locale={locale}
      onNavigate={onNavigate}
      section={section}
      t={t}
    />
  ));

  const showAll = (
    <OptionLink
      activeId={activeId}
      className={cn(
        LINK_CLASS,
        "px-2 py-1.5",
        isPanel ? "-mx-2" : "w-full justify-center py-3"
      )}
      href={searchHref(query)}
      id={SHOW_ALL_OPTION_ID}
      onNavigate={onNavigate}
    >
      {t("showAll", { count: response.total, query: query.trim() })}
      <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
    </OptionLink>
  );

  return (
    <div
      aria-busy={busy}
      aria-label={t("field.label")}
      id={listboxId}
      role="listbox"
    >
      {isPanel ? (
        <div
          className={cn(
            "grid gap-8",
            best && sections.length > 0 && "lg:grid-cols-[18rem_minmax(0,1fr)]"
          )}
        >
          {best ? (
            <BestMatch
              activeId={activeId}
              best={best}
              layout={layout}
              locale={locale}
              onNavigate={onNavigate}
              t={t}
            />
          ) : null}
          {groups.length > 0 ? (
            <div className="grid content-start gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {groups}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {best ? (
            <BestMatch
              activeId={activeId}
              best={best}
              layout={layout}
              locale={locale}
              onNavigate={onNavigate}
              t={t}
            />
          ) : null}
          {groups}
        </div>
      )}
      <div
        className={cn(
          "mt-6 border-edge border-t pt-4",
          isPanel && "flex flex-wrap items-center justify-between gap-4"
        )}
      >
        {showAll}
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
  onPickQuery?: (q: string) => void;
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
                  onClick={() => onPickQuery?.(item)}
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
  /** Must match the input's `aria-controls`. */
  listboxId?: string;
  onNavigate: (href: string) => void;
  /** A recent search was picked: put it in the field. */
  onPickQuery?: (q: string) => void;
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
        .getElementById(optionDomId(activeId))
        ?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeId]);

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
        activeId={activeId}
        busy={state.status === "loading"}
        layout={layout}
        listboxId={listboxId}
        onNavigate={onNavigate}
        query={query}
        response={response}
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
