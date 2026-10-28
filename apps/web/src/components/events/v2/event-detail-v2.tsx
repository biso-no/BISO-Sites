import type { Events } from "@repo/api/types/appwrite";
import { EventsLocationMode } from "@repo/api/types/appwrite";
import type { EventRsvpSummary } from "@repo/shared/utils/event-rsvp";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import {
  MembersOnlyBadge,
  MembersOnlyNotice,
} from "@/components/events/members-only";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { DateBlock } from "@/components/ui/date-block";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { getPrimaryTranslation } from "@/lib/content-translation";
import {
  EVENT_CATEGORY_MESSAGE_KEYS,
  type EventRegistrationMode,
  getEventHref,
  resolveEventRegistration,
} from "@/lib/types/event";
import {
  type EventPrice,
  eventPrice,
  formatEventDate,
  formatEventTime,
  formatEventTimeRange,
  isPastEvent,
  pickContent,
} from "./event-fields";
import { EventRsvp } from "./event-rsvp";
import { TicketLink } from "./ticket-link";

/**
 * The event detail page, rebuilt as a Server Component.
 *
 * The meta rail of the article template is replaced here by a **sticky action
 * card** (§4.3): when, where, what it costs, and the one thing to do next.
 *
 * What to do next follows `resolveEventRegistration`: a ticket link only when
 * there is a `ticket_url` to send the student to; "registration required" with
 * the deadline and capacity when the event takes sign-ups but has nowhere to
 * link; and "no registration needed — just show up" for a drop-in. The v1 page
 * once rendered a "Register Now" button on every event whose `onClick` fired an
 * analytics ping and nothing else; nothing here offers an action that does not
 * exist.
 *
 * A members-only event is shown to everyone with a notice: members are told
 * they can join, everyone else how to become one. A member sees the member
 * price they pay. Questions go to the event's own point of contact —
 * `contact_name`, `contact_role` and `contact_email` are per-event columns —
 * never to a hardcoded address.
 *
 * Everything on the card is read from the columns rather than from `metadata`,
 * which is `null` on every published row.
 */
export interface EventDetailV2Props {
  collectionEvents: Events[];
  event: Events;
  /** Signed-in member: member pricing applies and the notice confirms access. */
  isMember: boolean;
  locale: string;
  /** The viewer's RSVP state; `null` when answers are closed or unreadable. */
  rsvp?: { signedIn: boolean; summary: EventRsvpSummary | null } | null;
  /** Offer "already a member? sign in" — only to signed-out visitors. */
  showSignIn: boolean;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-edge border-b py-3 last:border-b-0">
      <dt className="type-label text-ink-muted">{label}</dt>
      <dd className="type-body-sm mt-1 text-ink">{value}</dd>
    </div>
  );
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const linkClass = `inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline ${focusRing}`;

const inlineLinkClass = `break-words text-ink-accent underline underline-offset-4 ${focusRing}`;

interface PriceCopy {
  free: string;
  memberPriceLabel: string;
  membersPrice: (price: string) => string;
  tba: string;
}

/** The amount as the card shows it, or the word for free/unknown. */
function priceText(price: EventPrice, copy: PriceCopy): string {
  if (price.kind === "free") {
    return copy.free;
  }
  if (price.kind === "unknown") {
    return copy.tba;
  }
  return `${price.amount} NOK`;
}

function PriceValue({
  copy,
  isMember,
  note,
  price,
}: {
  copy: PriceCopy;
  isMember: boolean;
  note: string | null;
  price: EventPrice;
}) {
  const noteLine = note ? (
    <span className="mt-1 block text-ink-muted">{note}</span>
  ) : null;

  if (price.kind !== "paid" || price.memberAmount === null) {
    return (
      <>
        {priceText(price, copy)}
        {noteLine}
      </>
    );
  }

  const memberAmount = `${price.memberAmount} NOK`;
  return (
    <>
      {isMember ? (
        <>
          <s className="text-ink-muted">{price.amount} NOK</s>
          <span className="mt-1 block text-ink">
            {memberAmount} {copy.memberPriceLabel}
          </span>
        </>
      ) : (
        <>
          {price.amount} NOK
          <span className="mt-1 block text-ink-accent">
            {copy.membersPrice(memberAmount)}
          </span>
        </>
      )}
      {noteLine}
    </>
  );
}

/** The server translator for the `events` namespace. */
type EventsTranslator = Awaited<ReturnType<typeof getTranslations<"events">>>;

interface RegistrationCopy {
  body: string;
  title: string;
}

/** Copy for the two modes with nothing to click; `ticket` gets the link. */
function registrationCopy(
  mode: EventRegistrationMode,
  memberOnly: boolean,
  t: EventsTranslator
): RegistrationCopy | null {
  if (mode === "ticket") {
    return null;
  }
  if (mode === "expected") {
    return {
      title: t("actions.registrationRequired"),
      body: t("actions.registrationPendingDescription"),
    };
  }
  return {
    title: t("actions.noRegistrationTitle"),
    body: memberOnly
      ? t("actions.noRegistrationMembersDescription")
      : t("actions.noRegistrationDescription"),
  };
}

/**
 * The line under the price — which price, for what. `collection_pricing`
 * defaults to "individual" on every row, so it means something only on a
 * collection parent.
 */
function priceNote(
  event: Events,
  price: EventPrice,
  collectionCount: number,
  t: EventsTranslator
): string | null {
  if (price.kind === "free") {
    return event.member_only
      ? t("infoCards.freeForMembers")
      : t("infoCards.freeEvent");
  }
  if (event.is_collection && event.collection_pricing === "bundle") {
    return t("infoCards.bundleAccess", { count: collectionCount });
  }
  if (event.is_collection && event.collection_pricing === "individual") {
    return t("infoCards.individualRegister");
  }
  if (event.collection_id && !event.is_collection) {
    return t("infoCards.partOfCollection");
  }
  return null;
}

function priceLabel(event: Events, t: EventsTranslator): string {
  if (event.is_collection && event.collection_pricing === "bundle") {
    return t("infoCards.bundlePrice");
  }
  if (event.is_collection && event.collection_pricing === "individual") {
    return t("infoCards.pricing");
  }
  return t("infoCards.price");
}

function RsvpBlock({
  event,
  hasTicket,
  isMember,
  rsvp,
}: {
  event: Events;
  hasTicket: boolean;
  isMember: boolean;
  rsvp: EventDetailV2Props["rsvp"];
}) {
  if (!rsvp?.summary?.open) {
    return null;
  }
  const eventPath = getEventHref(event) ?? "/events";
  return (
    <EventRsvp
      canRespond={rsvp.signedIn && (!event.member_only || isMember)}
      eventId={event.$id}
      hasTicket={hasTicket}
      initial={rsvp.summary}
      signedIn={rsvp.signedIn}
      signInHref={`/auth/login?redirectTo=${encodeURIComponent(eventPath)}`}
    />
  );
}

async function ActionCard({
  collectionCount,
  event,
  intlLocale,
  isMember,
  priceCopy,
  rsvp,
  showSignIn,
}: {
  collectionCount: number;
  event: Events;
  intlLocale: string;
  isMember: boolean;
  priceCopy: PriceCopy;
  rsvp: EventDetailV2Props["rsvp"];
  showSignIn: boolean;
}) {
  const t = await getTranslations("events");
  const date = event.start_date
    ? formatEventDate(event.start_date, intlLocale)
    : t("card.tba");
  const time = formatEventTimeRange(
    event.start_date,
    event.end_date,
    intlLocale
  );
  const online =
    event.location_mode !== EventsLocationMode.PHYSICAL && event.online_url;
  const price = eventPrice(event);
  const registration = resolveEventRegistration(event);
  const registrationNote = registrationCopy(
    registration.mode,
    Boolean(event.member_only),
    t
  );
  // A deadline is a moment, not a day: "closes 22 September, 23:59".
  const deadline = registration.deadline
    ? `${formatEventDate(registration.deadline, intlLocale)}, ${formatEventTime(registration.deadline, intlLocale)}`
    : null;
  const contactEmail = event.contact_email?.trim();
  const contactName = event.contact_name?.trim();
  const contactRole = event.contact_role?.trim();

  return (
    <div className="rounded-biso-md border border-edge bg-surface-raised p-6">
      <dl>
        <DetailRow label={t("modal.date")} value={date} />
        {time ? <DetailRow label={t("modal.time")} value={time} /> : null}
        <DetailRow
          label={t("modal.location")}
          value={event.location || t("card.locationTba")}
        />
        {online ? (
          <DetailRow
            label={t("detail.onlineLink")}
            value={
              <a
                className={linkClass}
                href={event.online_url ?? "#"}
                rel="noopener"
                target="_blank"
              >
                {t("detail.joinOnline")}
              </a>
            }
          />
        ) : null}
        <DetailRow
          label={priceLabel(event, t)}
          value={
            <PriceValue
              copy={priceCopy}
              isMember={isMember}
              note={priceNote(event, price, collectionCount, t)}
              price={price}
            />
          }
        />
        {/* `capacity` is 0 when unset, which is not a capacity of zero. */}
        {registration.capacity === null ? null : (
          <DetailRow
            label={t("detail.capacity")}
            value={t("detail.capacityValue", {
              count: registration.capacity,
            })}
          />
        )}
        {deadline ? (
          <DetailRow
            label={t("detail.registrationDeadline")}
            value={deadline}
          />
        ) : null}
      </dl>

      {registrationNote ? (
        <div className="mt-5">
          <p className="type-body-sm font-semibold text-ink">
            {registrationNote.title}
          </p>
          <p className="type-body-sm mt-1 text-ink-muted">
            {registrationNote.body}
          </p>
        </div>
      ) : null}

      {event.member_only ? (
        <div className="mt-5">
          <MembersOnlyNotice isMember={isMember} showSignIn={showSignIn} />
        </div>
      ) : null}

      {registration.ticketUrl ? (
        <div className="mt-5">
          <TicketLink
            eventId={event.slug ?? event.$id}
            href={registration.ticketUrl}
            label={t("detail.getTickets")}
          />
        </div>
      ) : null}

      <RsvpBlock
        event={event}
        hasTicket={Boolean(registration.ticketUrl)}
        isMember={isMember}
        rsvp={rsvp}
      />

      {contactEmail ? (
        <div className="mt-5 border-edge border-t pt-5">
          <p className="type-label text-ink-muted">
            {t("infoCards.questions")}
          </p>
          <p className="type-body-sm mt-2 text-ink">
            {contactName
              ? t("infoCards.contactPerson", { name: contactName })
              : t("infoCards.contactOrganizer")}{" "}
            <a className={inlineLinkClass} href={`mailto:${contactEmail}`}>
              {contactEmail}
            </a>
          </p>
          {contactName && contactRole ? (
            <p className="type-body-sm mt-1 text-ink-muted">{contactRole}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface CollectionCopy {
  description: string | null;
  priceFor: (event: Events) => string | null;
  pricing: string | null;
  title: string;
}

function CollectionList({
  copy,
  events,
  locale,
}: {
  copy: CollectionCopy;
  events: Events[];
  locale: string;
}) {
  if (events.length === 0) {
    return null;
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="type-heading-section text-ink">{copy.title}</h2>
        {copy.pricing ? <Pill tone="neutral">{copy.pricing}</Pill> : null}
      </div>
      {copy.description ? (
        <p className="type-body-sm mt-3 max-w-(--measure) text-ink-muted">
          {copy.description}
        </p>
      ) : null}
      <ul className="mt-5 space-y-3">
        {events.map((event) => {
          const href = getEventHref(event);
          const price = copy.priceFor(event);
          const row = (
            <>
              {event.start_date ? (
                <DateBlock
                  date={event.start_date}
                  locale={locale === "no" ? "nb-NO" : "en-GB"}
                />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="type-heading-card block text-ink">
                  {getPrimaryTranslation(event, locale)?.title}
                </span>
                {event.location ? (
                  <span className="type-body-sm mt-1 block text-ink-muted">
                    {event.location}
                  </span>
                ) : null}
              </span>
              {price ? (
                <span className="type-data shrink-0 text-ink-muted">
                  {price}
                </span>
              ) : null}
            </>
          );
          const rowClass =
            "flex items-start gap-4 rounded-biso-md border border-edge p-4";
          return (
            <li key={event.$id}>
              {/* The detail route resolves by slug; a row without one is
                  listed without a link rather than linked to a 404. */}
              {href ? (
                <Link
                  className={`${rowClass} transition-colors hover:border-ink-accent ${focusRing}`}
                  href={href}
                >
                  {row}
                </Link>
              ) : (
                <div className={rowClass}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export async function EventDetailV2({
  event,
  collectionEvents,
  isMember,
  locale,
  rsvp,
  showSignIn,
}: EventDetailV2Props) {
  const [t, tCommon, tNav] = await Promise.all([
    getTranslations("events"),
    getTranslations("common"),
    getTranslations("common.navigation"),
  ]);

  const intlLocale = locale === "no" ? "nb-NO" : "en-GB";
  const content = pickContent(event.translation_refs, locale);
  const past = isPastEvent(event, new Date());
  const translated =
    content.descriptionLocale === null || content.descriptionLocale === locale;

  // The rest of the collection: a parent lists its sessions, a session lists
  // its siblings. Pricing is the collection's, which only the parent carries
  // (`collection_pricing` defaults to "individual" on every row).
  const others = collectionEvents.filter((item) => item.$id !== event.$id);
  const isParent = Boolean(event.is_collection);
  const collectionPricing =
    (isParent ? event : collectionEvents.find((item) => item.is_collection))
      ?.collection_pricing ?? null;
  const priceCopy: PriceCopy = {
    free: t("card.free"),
    memberPriceLabel: t("card.memberPriceLabel"),
    membersPrice: (amount) => t("card.membersPrice", { price: amount }),
    tba: t("card.priceTba"),
  };
  let collectionDescription: string | null = null;
  let collectionPricingLabel: string | null = null;
  if (isParent && collectionPricing === "bundle") {
    collectionPricingLabel = t("collection.bundlePricing");
    collectionDescription = t("collection.bundleDescription", {
      price: priceText(eventPrice(event), priceCopy),
      count: others.length,
    });
  } else if (isParent && collectionPricing === "individual") {
    collectionPricingLabel = t("collection.individualPricing");
    collectionDescription = t("collection.individualDescription");
  }

  return (
    <>
      <PageHeader
        actions={
          <CopyLinkButton
            copiedLabel={t("detail.copied")}
            copyLabel={t("detail.share")}
            shareTitle={content.title}
            track={{
              event: "share",
              props: { type: "event", eventId: event.slug ?? event.$id },
            }}
          />
        }
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: tNav("events"), href: "/events" },
          { label: content.title },
        ]}
        lede={content.shortDescription ?? undefined}
        meta={
          <>
            {event.category ? (
              <Pill tone="accent" uppercase>
                {t(`filters.${EVENT_CATEGORY_MESSAGE_KEYS[event.category]}`)}
              </Pill>
            ) : null}
            {event.member_only ? <MembersOnlyBadge /> : null}
            {past ? <Pill tone="neutral">{t("card.past")}</Pill> : null}
            {event.campus?.name ? (
              <Pill tone="neutral">{event.campus.name}</Pill>
            ) : null}
          </>
        }
        title={content.title}
      />

      <Section tone="paper">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* The action card is first in source order so a phone reader — and a
              keyboard user — reaches when/where/what-it-costs before a long
              description. `order` puts it back on the right at desktop, where
              it becomes the sticky rail the article template calls for. */}
          <aside className="lg:order-2">
            <div className="space-y-6 lg:sticky lg:top-24">
              <ActionCard
                collectionCount={others.length}
                event={event}
                intlLocale={intlLocale}
                isMember={isMember}
                priceCopy={priceCopy}
                rsvp={rsvp}
                showSignIn={showSignIn}
              />

              {event.tags && event.tags.length > 0 ? (
                <div>
                  <h2 className="type-label text-ink-muted">
                    {t("detail.tags")}
                  </h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {event.tags.map((tag) => (
                      <li key={tag}>
                        <Pill tone="neutral">{tag}</Pill>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Link className={linkClass} href="/events">
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                <span className="type-label">{t("hero.backToEvents")}</span>
              </Link>
            </div>
          </aside>

          <div className="min-w-0 space-y-10 lg:order-1">
            {event.image ? (
              <ChevronFrame className="bg-surface-sunken" ratio="21/9">
                <Image
                  alt=""
                  height={540}
                  priority
                  sizes="(max-width: 1024px) 100vw, 760px"
                  src={event.image}
                  width={1260}
                />
              </ChevronFrame>
            ) : null}

            <div>
              <h2 className="type-heading-section text-ink">
                {t("modal.about")}
              </h2>
              {translated ? null : (
                // Said plainly rather than silently swapping languages: the
                // Norwegian rows for two of the three published events carry an
                // empty description, and the English copy is the only copy.
                <p className="type-body-sm mt-3 text-ink-muted">
                  {t("detail.translationFallback")}
                </p>
              )}
              <Prose className="mt-5">
                <PlateContentRenderer value={content.description || null} />
              </Prose>
            </div>

            <CollectionList
              copy={{
                description: collectionDescription,
                pricing: collectionPricingLabel,
                // Sessions sold one by one show what each costs.
                priceFor: (item) =>
                  collectionPricing === "individual"
                    ? priceText(eventPrice(item), priceCopy)
                    : null,
                title: isParent
                  ? t("collection.title")
                  : t("collection.otherTitle"),
              }}
              events={others}
              locale={locale}
            />
          </div>
        </div>
      </Section>
    </>
  );
}
