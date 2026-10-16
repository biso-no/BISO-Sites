import type { Events, EventsCategory } from "@repo/api/types/appwrite";
import Image from "next/image";
import Link from "next/link";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { DateBlock } from "@/components/ui/date-block";
import { Pill } from "@/components/ui/pill";
import { getPrimaryTranslation } from "@/lib/content-translation";
import { EVENT_CATEGORY_MESSAGE_KEYS, getEventHref } from "@/lib/types/event";
import { EVENT_CATEGORIES, eventPrice, isPastEvent } from "./event-fields";

/**
 * One card in the `/events` grid, shared by the server-rendered first page and
 * the client "Load more" island that appends the pages after it.
 *
 * Deliberately free of server-only imports (`next-intl/server`,
 * `@repo/api/server`) and of hooks, so both sides render it: every string
 * arrives pre-translated in `labels`, which `eventCardLabels` builds from
 * whichever translator the caller holds — `getTranslations` on the server,
 * `useTranslations` in the island — so an appended page is the same markup as
 * the first.
 *
 * What the card states, and where each fact comes from:
 * - it **links to `/events/[slug]`** through `getEventHref`, and a row without
 *   a usable slug is shown without a link rather than given one that 404s;
 * - a **members-only** event carries a pill — `member_only` limits who can
 *   join, never who can see, so nothing here filters on it;
 * - the **price** reads `pricing_mode` / `price` / `member_price`, and a
 *   signed-in member sees the member price they pay, everyone else the public
 *   price with the member price beneath it;
 * - the status pill derives from `ticket_url` ("Register" / "Info only").
 */

type Translate = (
  key: string,
  values?: Record<string, number | string>
) => string;

export interface EventCardLabels {
  categories: Record<EventsCategory, string>;
  collection: string;
  free: string;
  infoOnly: string;
  /** "(Member Price)", after the price a signed-in member pays. */
  memberPriceLabel: string;
  membersOnly: string;
  /** "Members: 269 NOK", under the public price for everyone else. */
  membersPrice: (price: string) => string;
  past: string;
  priceTba: string;
  registerNow: string;
}

/** Card copy from the `events` namespace, for either translator. */
export function eventCardLabels(t: Translate): EventCardLabels {
  const categories = {} as Record<EventsCategory, string>;
  for (const category of EVENT_CATEGORIES) {
    categories[category] = t(
      `filters.${EVENT_CATEGORY_MESSAGE_KEYS[category]}`
    );
  }
  return {
    categories,
    collection: t("card.collection"),
    free: t("card.free"),
    infoOnly: t("card.infoOnly"),
    memberPriceLabel: t("card.memberPriceLabel"),
    membersOnly: t("card.membersOnly"),
    membersPrice: (price) => t("card.membersPrice", { price }),
    past: t("card.past"),
    priceTba: t("card.priceTba"),
    registerNow: t("card.registerNow"),
  };
}

function CardPrice({
  event,
  isMember,
  labels,
}: {
  event: Events;
  isMember: boolean;
  labels: EventCardLabels;
}) {
  const price = eventPrice(event);
  if (price.kind === "free") {
    return <span className="type-data text-ink-muted">{labels.free}</span>;
  }
  if (price.kind === "unknown") {
    return <span className="type-data text-ink-muted">{labels.priceTba}</span>;
  }

  const amount = `${price.amount} NOK`;
  if (price.memberAmount === null) {
    return <span className="type-data text-ink-muted">{amount}</span>;
  }

  const memberAmount = `${price.memberAmount} NOK`;
  if (isMember) {
    return (
      <span className="type-data flex flex-wrap items-baseline gap-x-2">
        <s className="text-ink-muted">{amount}</s>
        <span className="text-ink">
          {memberAmount} {labels.memberPriceLabel}
        </span>
      </span>
    );
  }
  return (
    <span className="type-data flex flex-col">
      <span className="text-ink-muted">{amount}</span>
      <span className="text-ink-accent">
        {labels.membersPrice(memberAmount)}
      </span>
    </span>
  );
}

function EventCardBody({
  event,
  isMember,
  labels,
  locale,
  title,
}: {
  event: Events;
  isMember: boolean;
  labels: EventCardLabels;
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
        {event.category ? (
          <Pill tone="accent" uppercase>
            {labels.categories[event.category]}
          </Pill>
        ) : null}
        {event.is_collection ? (
          <Pill tone="neutral">{labels.collection}</Pill>
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
        <CardPrice event={event} isMember={isMember} labels={labels} />
        {/* Derived from `ticket_url`, never hardcoded — same rule as home. */}
        <Pill tone={event.ticket_url ? "success" : "accent"}>
          {event.ticket_url ? labels.registerNow : labels.infoOnly}
        </Pill>
      </span>
    </>
  );
}

export interface EventCardV2Props {
  event: Events;
  /** Signed-in member: shown the member price they pay. Never filters. */
  isMember: boolean;
  labels: EventCardLabels;
  locale: string;
}

export function EventCardV2({
  event,
  isMember,
  labels,
  locale,
}: EventCardV2Props) {
  const title = getPrimaryTranslation(event, locale)?.title ?? "";
  const href = getEventHref(event);
  const body = (
    <EventCardBody
      event={event}
      isMember={isMember}
      labels={labels}
      locale={locale}
      title={title}
    />
  );
  const shell = "group flex h-full flex-col";

  return (
    <li>
      {href ? (
        <Link
          className={`${shell} rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface`}
          href={href}
        >
          {body}
        </Link>
      ) : (
        <div className={shell}>{body}</div>
      )}
    </li>
  );
}
