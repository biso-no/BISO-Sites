"use client";

import { ChevronMedia } from "@/blocks/_v2/chevron-media";
import { DateBlock } from "@/blocks/_v2/date-block";
import { FeedCardShell, FeedSection } from "@/blocks/_v2/feed-section";
import { Pill } from "@/blocks/_v2/pill";
import { useBlockFeed } from "@/blocks/_v2/use-block-feed";
import type { PatchFn } from "@/blocks/types";
import type { EditorLocale, EventsBlock } from "@/editor/types";

interface FeedEvent {
  category?: string;
  href?: string;
  id?: string;
  image?: string;
  memberOnly?: boolean;
  startsAt?: string;
  ticketUrl?: string;
  title?: string;
  where?: string;
}

const LABELS: Record<
  EditorLocale,
  { info: string; members: string; register: string }
> = {
  en: { info: "Info only", members: "Members only", register: "Register" },
  no: { info: "Kun info", members: "Kun for medlemmer", register: "Påmelding" },
};

const CARD = "group flex h-full flex-col rounded-biso-sm";

function EventCard({
  edit,
  event,
  locale,
}: {
  edit: boolean;
  event: FeedEvent;
  locale: EditorLocale;
}) {
  const labels = LABELS[locale] ?? LABELS.no;
  const category =
    typeof event.category === "string"
      ? event.category.replaceAll("_", " ")
      : "";
  return (
    <FeedCardShell className={CARD} edit={edit} href={event.href}>
      {event.image ? (
        <ChevronMedia ratio="16/9" src={event.image} width={640} />
      ) : null}
      {category || event.memberOnly ? (
        <span className="mt-4 flex flex-wrap items-center gap-2">
          {category ? (
            <Pill tone="accent" uppercase>
              {category}
            </Pill>
          ) : null}
          {event.memberOnly ? (
            <Pill tone="warning">{labels.members}</Pill>
          ) : null}
        </span>
      ) : null}
      <span className="mt-3 flex items-start gap-4">
        {event.startsAt ? (
          <DateBlock iso={event.startsAt} locale={locale} />
        ) : null}
        <span className="min-w-0">
          <span className="type-heading-card block text-ink group-hover:text-ink-accent">
            {event.title}
          </span>
          {event.where ? (
            <span className="type-body-sm mt-1 block text-ink-muted">
              {event.where}
            </span>
          ) : null}
        </span>
      </span>
      <span className="mt-auto flex justify-end pt-4">
        <Pill tone={event.ticketUrl ? "success" : "accent"}>
          {event.ticketUrl ? labels.register : labels.info}
        </Pill>
      </span>
    </FeedCardShell>
  );
}

interface Props {
  block: EventsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function EventsRender({ block, edit, onPatch }: Props) {
  const { dept, items, locale } = useBlockFeed<FeedEvent>(
    "events",
    block.source,
    block.limit
  );
  return (
    <FeedSection
      dept={dept}
      edit={edit}
      heading={block.heading}
      items={items}
      locale={locale}
      noun="upcoming events"
      onPatch={onPatch}
      seeAll={block.seeAll !== false}
      seeAllHref="/events"
    >
      {(items ?? []).map((event, i) => (
        <EventCard
          edit={edit}
          event={event}
          key={event.id ?? i}
          locale={locale}
        />
      ))}
    </FeedSection>
  );
}
