import type { Events } from "@repo/api/types/appwrite";
import { EventsLocationMode } from "@repo/api/types/appwrite";
import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { ArrowLeft, Mail, Ticket } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { DateBlock } from "@/components/ui/date-block";
import { PageHeader } from "@/components/ui/page-header";
import { Pill } from "@/components/ui/pill";
import { Prose } from "@/components/ui/prose";
import { Section } from "@/components/ui/section";
import { getPrimaryTranslation } from "@/lib/content-translation";
import {
  eventPrice,
  formatEventDate,
  formatEventTimeRange,
  isPastEvent,
  pickContent,
} from "./event-fields";

/**
 * The event detail page, rebuilt as a Server Component.
 *
 * The meta rail of the article template is replaced here by a **sticky action
 * card** (§4.3): when, where, what it costs, and the one thing to do next. That
 * card is also where this page stops making a promise the data cannot keep.
 *
 * **The current page renders a dead "Register Now" button.** When `ticket_url`
 * is absent — which it is on every published event — `EventActions` still shows
 * a full-width primary CTA reading "Register Now", under the line "Spaces are
 * limited! Register now to guarantee your attendance." Its `onClick` fires an
 * analytics event and nothing else: there is no registration system behind it,
 * and for the one paid event the real mechanism is a discount code written in
 * the body copy. Here a ticket link renders only when there is a ticket to link
 * to; otherwise the card offers the event's own organiser, whose name, role and
 * address are real columns the current page ignores in favour of a hardcoded
 * `events@biso.no`.
 *
 * Everything else on the card is likewise read from the columns rather than
 * from `metadata`, which is `null` on every published row.
 */
export interface EventDetailV2Props {
  collectionEvents: Events[];
  event: Events;
  locale: string;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-edge border-b py-3 last:border-b-0">
      <dt className="type-label text-ink-muted">{label}</dt>
      <dd className="type-body-sm mt-1 text-ink">{value}</dd>
    </div>
  );
}

const linkClass =
  "inline-flex items-center gap-2 text-ink-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

function PriceRow({
  event,
  label,
  freeLabel,
  tbaLabel,
  memberLabel,
}: {
  event: Events;
  freeLabel: string;
  label: string;
  memberLabel: (price: string) => string;
  tbaLabel: string;
}) {
  const price = eventPrice(event);
  if (price.kind === "free") {
    return <DetailRow label={label} value={freeLabel} />;
  }
  if (price.kind === "unknown") {
    return <DetailRow label={label} value={tbaLabel} />;
  }
  return (
    <DetailRow
      label={label}
      value={
        <>
          {price.amount} NOK
          {price.memberAmount === null ? null : (
            <span className="mt-1 block text-ink-accent">
              {memberLabel(`${price.memberAmount} NOK`)}
            </span>
          )}
        </>
      }
    />
  );
}

async function ActionCard({
  event,
  intlLocale,
}: {
  event: Events;
  intlLocale: string;
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
        <PriceRow
          event={event}
          freeLabel={t("card.free")}
          label={t("infoCards.price")}
          memberLabel={(price) => t("card.membersPrice", { price })}
          tbaLabel={t("card.priceTba")}
        />
        {/* `capacity` is 0 when unset, which is not a capacity of zero. */}
        {event.capacity > 0 ? (
          <DetailRow
            label={t("detail.capacity")}
            value={t("detail.capacityValue", { count: event.capacity })}
          />
        ) : null}
        {event.registration_deadline ? (
          <DetailRow
            label={t("detail.registrationDeadline")}
            value={formatEventDate(event.registration_deadline, intlLocale)}
          />
        ) : null}
      </dl>

      {event.ticket_url ? (
        <a
          className="type-label mt-5 inline-flex w-full items-center justify-center gap-2 rounded-biso-sm bg-action px-4 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          href={event.ticket_url}
          rel="noopener"
          target="_blank"
        >
          <Ticket aria-hidden="true" className="h-4 w-4" />
          {t("detail.getTickets")}
        </a>
      ) : (
        <p className="type-body-sm mt-5 text-ink-muted">
          {t("detail.noRegistration")}
        </p>
      )}

      {event.contact_email ? (
        <div className="mt-5 border-edge border-t pt-5">
          <p className="type-label text-ink-muted">{t("detail.organiser")}</p>
          <a
            className={`${linkClass} mt-2`}
            href={`mailto:${event.contact_email}`}
          >
            <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words">
              {event.contact_name || event.contact_email}
            </span>
          </a>
          {event.contact_role ? (
            <p className="type-body-sm mt-1 text-ink-muted">
              {event.contact_role}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CollectionList({
  events,
  currentId,
  locale,
  title,
}: {
  currentId: string;
  events: Events[];
  locale: string;
  title: string;
}) {
  const others = events.filter((event) => event.$id !== currentId);
  if (others.length === 0) {
    return null;
  }
  return (
    <div>
      <h2 className="type-heading-section text-ink">{title}</h2>
      <ul className="mt-5 space-y-3">
        {others.map((event) => (
          <li key={event.$id}>
            <Link
              className="flex items-start gap-4 rounded-biso-md border border-edge p-4 transition-colors hover:border-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={`/events/${event.slug}`}
            >
              {event.start_date ? (
                <DateBlock
                  date={event.start_date}
                  locale={locale === "no" ? "nb-NO" : "en-GB"}
                />
              ) : null}
              <span className="min-w-0">
                <span className="type-heading-card block text-ink">
                  {getPrimaryTranslation(event, locale)?.title}
                </span>
                {event.location ? (
                  <span className="type-body-sm mt-1 block text-ink-muted">
                    {event.location}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function EventDetailV2({
  event,
  collectionEvents,
  locale,
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

  return (
    <>
      <PageHeader
        actions={
          <CopyLinkButton
            copiedLabel={t("detail.copied")}
            copyLabel={t("detail.share")}
            shareTitle={content.title}
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
                {t(`category.${event.category}`)}
              </Pill>
            ) : null}
            {event.member_only ? (
              <Pill tone="warning">{t("card.membersOnly")}</Pill>
            ) : null}
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
              <ActionCard event={event} intlLocale={intlLocale} />

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
              currentId={event.$id}
              events={collectionEvents}
              locale={locale}
              title={t("collection.otherTitle")}
            />
          </div>
        </div>
      </Section>
    </>
  );
}
