import type { Events, EventsCategory } from "@repo/api/types/appwrite";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { FeedSearch } from "@/components/ui/feed-search";
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { EventCardV2, eventCardLabels } from "./event-card-v2";
import { EVENT_CATEGORIES } from "./event-fields";
import { EventsFeedList } from "./events-feed-list";

/**
 * The events feed: a Server Component with link-based filters, over main's
 * paged reader.
 *
 * Three things the v1 list got wrong against the real data, all fixed here:
 *
 * 1. **Nothing linked to an event.** Every card opened a modal from a
 *    `<Button onClick>`, so `/events/[slug]` was reachable from no page. Cards
 *    are links (`EventCardV2`).
 * 2. **The category filter could not match anything.** It parsed a `metadata`
 *    blob that is null on every published row. Chips now run on the real
 *    `category` column — filtered in the query by `listEvents`, offered from
 *    `listEventFacets`, so a category no published event carries is not
 *    offered.
 * 3. **Member-only events were hidden from everybody.** `member_only` limits
 *    who can join, not who can see: the card states it, and `isMember` only
 *    decides which price a card leads with.
 *
 * Campus is not a control on this page. The header switcher is the one place
 * to change campus (Branding Committee, #95); on this route it rewrites
 * `?campus=<slug>`, which the page resolves with `resolveRequestCampus`, so a
 * scoped view stays a shareable URL. Search and the category chips carry the
 * parameter forward.
 *
 * Paging, search and "finished events are hidden" are the data layer's:
 * `listEvents({ upcomingOnly: true })` filters and orders by start date in the
 * query and searches through `content_translations`, so page 1 here and every
 * page `EventsFeedList` appends come from the same query.
 */
export interface EventsV2Props {
  /** Resolved campus id (URL > cookie > all); `null` is every campus. */
  campusId: string | null;
  /** Phase-1 search hit its cap, so `total` counts the first matches only. */
  capped: boolean;
  /** Categories some published event in scope carries (`listEventFacets`). */
  categories: EventsCategory[];
  /** The validated `?category=`, or null for none. */
  category: EventsCategory | null;
  /** Page 1, as `listEvents` returned it. */
  events: Events[];
  isMember: boolean;
  locale: "en" | "no";
  /** The trimmed search term (`?q=`, or the older `?search=`). */
  search: string;
  /** The request's query string, so filters keep the parameters they don't own. */
  searchParams: Record<string, string | string[] | undefined>;
  /** Rows matching the filters across every page. */
  total: number;
}

/**
 * Dropped from every filter link: a new filter starts at page 1, and the search
 * term is re-added under `q` — the name `listEvents`' callers read — so a link
 * made from an old `?search=` URL carries it forward under the current name.
 * `?campus=` is kept, so a category chip never widens a campus-scoped view.
 */
const RESET_ON_FILTER = new Set(["page", "q", "search"]);

export async function EventsV2({
  campusId,
  capped,
  categories,
  category,
  events,
  isMember,
  locale,
  search,
  searchParams,
  total,
}: EventsV2Props): Promise<ReactNode> {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("events"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);
  const labels = eventCardLabels(t);

  const filterParams: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (!RESET_ON_FILTER.has(key)) {
      filterParams[key] = value;
    }
  }
  if (search) {
    filterParams.q = search;
  }

  // Searching must not silently drop the category or campus already chosen.
  const searchHidden: Record<string, string> = {};
  for (const key of ["campus", "category"]) {
    const value = searchParams[key];
    if (typeof value === "string") {
      searchHidden[key] = value;
    }
  }

  // Facets list what published events carry; a hand-typed `?category=` for a
  // category none carries still filters, and still shows as the active chip.
  const categoryOptions: FilterOption[] = [
    { value: "all", label: t("filters.all") },
    ...EVENT_CATEGORIES.filter(
      (value) => value === category || categories.includes(value)
    ).map((value) => ({ value, label: labels.categories[value] })),
  ];

  const hasActiveFilters =
    search !== "" ||
    category !== null ||
    typeof searchParams.campus === "string";
  const campusKey = campusId ?? "all";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("events") },
        ]}
        lede={t("hero.discoverDescription")}
        title={tNav("events")}
      />

      <Section tone="paper">
        <div className="mb-8 space-y-3">
          <FeedSearch
            action="/events"
            defaultValue={search}
            hidden={searchHidden}
            label={t("filters.searchLabel")}
            name="q"
            placeholder={t("filters.searchPlaceholder")}
            submitLabel={t("filters.searchSubmit")}
            surface="events"
          />
          <FilterChips
            active={category ?? "all"}
            basePath="/events"
            label={t("filters.categoryLabel")}
            options={categoryOptions}
            param="category"
            searchParams={filterParams}
          />
        </div>

        <p className="type-body-sm mb-6 text-ink-muted">
          {capped
            ? t("filters.showingFirstResults", { count: total })
            : t("filters.showingResults", { count: total })}
        </p>

        {events.length > 0 ? (
          <EventsFeedList
            campus={campusKey}
            category={category}
            firstPageCount={events.length}
            isMember={isMember}
            key={`${campusKey}|${category ?? "all"}|${search}`}
            locale={locale}
            search={search}
            total={total}
          >
            {events.map((event) => (
              <EventCardV2
                event={event}
                isMember={isMember}
                key={event.$id}
                labels={labels}
                locale={locale}
              />
            ))}
          </EventsFeedList>
        ) : (
          <div>
            <p className="type-heading-card text-ink">
              {t("emptyState.title")}
            </p>
            <p className="type-body mt-2 text-ink-muted">
              {t("emptyState.description")}
            </p>
            {hasActiveFilters ? (
              <Link
                className="type-label mt-5 inline-flex text-ink-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                href="/events"
              >
                {t("filters.clearFilters")}
              </Link>
            ) : null}
          </div>
        )}
      </Section>
    </>
  );
}
