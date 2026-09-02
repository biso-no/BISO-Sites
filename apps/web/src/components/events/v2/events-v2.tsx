import type { Events } from "@repo/api/types/appwrite";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { CardGrid } from "@/components/ui/card-grid";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { DateBlock } from "@/components/ui/date-block";
import { FilterChips, type FilterOption } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { CAMPUS_SLUGS, campusIdToSlug } from "@/lib/campus-scope";
import { getPrimaryTranslation } from "@/lib/content-translation";
import {
  EVENT_CATEGORIES,
  eventPrice,
  isPastEvent,
  parseCategory,
  sortForFeed,
} from "./event-fields";

/**
 * The events feed, rebuilt as a Server Component with link-based filters.
 *
 * Three things the current list gets wrong against the real data, all fixed
 * here and all visible on the live site today:
 *
 * 1. **Nothing links to an event.** Every card opens `<EventDetailModal>` from
 *    a `<Button onClick>`, so `/events/[slug]` — which exists, is indexed in
 *    the sitemap and is what a shared link resolves to — is unreachable from
 *    the feed and appears in none of its HTML. Cards are links now.
 * 2. **The category filter cannot match anything.** It reads
 *    `JSON.parse(metadata).category` against a hardcoded five-value list, and
 *    `metadata` is null on every published row, so four chips return zero
 *    results and one returns everything. Chips run on the real `category` enum.
 * 3. **Member-only events are hidden from everybody.** The list drops them
 *    unless `isMember`, and `isMember` is never passed — while the detail page
 *    renders the same event in full to anonymous visitors. `member_only` is a
 *    pricing and access fact, not a visibility one, so the card states it
 *    rather than suppressing the event.
 *
 * Chips are derived from the data, so a category no event carries is not
 * offered; a hand-typed `?category=` for any of the eight enum values still
 * filters correctly.
 */
export interface EventsV2Props {
  campusId: string | null;
  events: Events[];
  locale: string;
  searchParams: Record<string, string | string[] | undefined>;
}

interface CardLabels {
  free: string;
  infoOnly: string;
  membersOnly: string;
  past: string;
  priceTba: string;
  registerNow: string;
}

function PriceLine({ event, labels }: { event: Events; labels: CardLabels }) {
  const price = eventPrice(event);
  if (price.kind === "free") {
    return <span className="type-data text-ink-muted">{labels.free}</span>;
  }
  if (price.kind === "unknown") {
    return <span className="type-data text-ink-muted">{labels.priceTba}</span>;
  }
  return <span className="type-data text-ink-muted">{price.amount} NOK</span>;
}

function EventCardBody({
  event,
  labels,
  locale,
  categoryLabel,
  title,
}: {
  categoryLabel: string | null;
  event: Events;
  labels: CardLabels;
  locale: string;
  title: string;
}) {
  const past = isPastEvent(event, new Date());
  return (
    <>
      {event.image ? (
        <ChevronFrame className="bg-surface-sunken" ratio="16/9">
          <Image
            alt=""
            className="transition-transform duration-500 group-hover:scale-[1.03]"
            height={360}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
            src={event.image}
            width={640}
          />
        </ChevronFrame>
      ) : null}

      <span className="mt-4 flex flex-wrap items-center gap-2">
        {categoryLabel ? (
          <Pill tone="accent" uppercase>
            {categoryLabel}
          </Pill>
        ) : null}
        {event.member_only ? (
          <Pill tone="warning">{labels.membersOnly}</Pill>
        ) : null}
        {past ? <Pill tone="neutral">{labels.past}</Pill> : null}
      </span>

      <span className="mt-3 flex items-start gap-4">
        {event.start_date ? (
          <DateBlock
            date={event.start_date}
            locale={locale === "no" ? "nb-NO" : "en-GB"}
          />
        ) : null}
        <span className="min-w-0">
          <span className="type-heading-card block text-ink group-hover:text-ink-accent">
            {title}
          </span>
          {event.location ? (
            <span className="type-body-sm mt-1 block text-ink-muted">
              {event.location}
            </span>
          ) : null}
        </span>
      </span>

      <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <PriceLine event={event} labels={labels} />
        {/* Derived from `ticket_url`, never hardcoded — same rule as home. */}
        <Pill tone={event.ticket_url ? "success" : "accent"}>
          {event.ticket_url ? labels.registerNow : labels.infoOnly}
        </Pill>
      </span>
    </>
  );
}

function EventCard({
  event,
  labels,
  locale,
  categoryLabel,
}: {
  categoryLabel: string | null;
  event: Events;
  labels: CardLabels;
  locale: string;
}) {
  const title = getPrimaryTranslation(event, locale)?.title ?? "";
  const body = (
    <EventCardBody
      categoryLabel={categoryLabel}
      event={event}
      labels={labels}
      locale={locale}
      title={title}
    />
  );
  const shell = "group flex h-full flex-col";

  return (
    <li>
      {/* An event with no slug has no detail URL to point at, so it is shown
          without a link rather than given one that would 404. */}
      {event.slug ? (
        <Link
          className={`${shell} rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface`}
          href={`/events/${event.slug}`}
        >
          {body}
        </Link>
      ) : (
        <div className={shell}>{body}</div>
      )}
    </li>
  );
}

export async function EventsV2({
  events,
  locale,
  searchParams,
  campusId,
}: EventsV2Props): Promise<ReactNode> {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("events"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const activeCategory = parseCategory(searchParams.category);

  // A collection's child sessions are reachable from the collection's own page
  // (`getCollectionEvents` builds the sibling list there); listing them here as
  // well makes one event look like several. The v1 feed excluded them with this
  // predicate and the rewrite dropped it — restored before the counts are
  // derived, so the category chips agree with what the grid shows.
  const feed = events.filter(
    (event) => event.is_collection || !event.collection_id
  );

  const present = EVENT_CATEGORIES.filter((category) =>
    feed.some((event) => event.category === category)
  );
  const categoryOptions: FilterOption[] = [
    { value: "all", label: t("filters.all") },
    ...present.map((category) => ({
      value: category,
      label: t(`category.${category}`),
      count: feed.filter((event) => event.category === category).length,
    })),
  ];

  const campusOptions: FilterOption[] = [
    { value: "all", label: tNav("allCampuses") },
    ...CAMPUS_SLUGS.map((slug) => ({
      value: slug,
      label: slug.charAt(0).toUpperCase() + slug.slice(1),
    })),
  ];

  const visible = sortForFeed(
    activeCategory
      ? feed.filter((event) => event.category === activeCategory)
      : feed,
    new Date()
  );

  const labels: CardLabels = {
    free: t("card.free"),
    infoOnly: t("card.infoOnly"),
    membersOnly: t("card.membersOnly"),
    past: t("card.past"),
    priceTba: t("card.priceTba"),
    registerNow: t("card.registerNow"),
  };

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
          <FilterChips
            active={activeCategory ?? "all"}
            basePath="/events"
            label={t("filters.categoryLabel")}
            options={categoryOptions}
            param="category"
            searchParams={searchParams}
          />
          <FilterChips
            active={campusIdToSlug(campusId) ?? "all"}
            basePath="/events"
            label={t("filters.campusLabel")}
            options={campusOptions}
            param="campus"
            searchParams={searchParams}
          />
        </div>

        <p className="type-body-sm mb-6 text-ink-muted">
          {t("filters.showingResults", { count: visible.length })}
        </p>

        {visible.length > 0 ? (
          <CardGrid className="gap-x-6 gap-y-10">
            {visible.map((event) => (
              <EventCard
                categoryLabel={
                  event.category ? t(`category.${event.category}`) : null
                }
                event={event}
                key={event.$id}
                labels={labels}
                locale={locale}
              />
            ))}
          </CardGrid>
        ) : (
          <div>
            <p className="type-heading-card text-ink">
              {t("emptyState.title")}
            </p>
            <p className="type-body mt-2 text-ink-muted">
              {t("emptyState.description")}
            </p>
            <Link
              className="type-label mt-5 inline-flex text-ink-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/events"
            >
              {t("filters.clearFilters")}
            </Link>
          </div>
        )}
      </Section>
    </>
  );
}
