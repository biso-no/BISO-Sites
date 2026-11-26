import type { AudienceMember } from "@repo/shared/big-events/messages/audience";
import type {
  LocalizedVars,
  VarsBus,
} from "@repo/shared/big-events/messages/plan";
import {
  type Placeholder,
  renderText,
} from "@repo/shared/big-events/messages/text";
import type { GroupLeg } from "@repo/shared/big-events/tables";
import type { BigEventParticipantRow } from "@repo/shared/big-events/types";
import { type MessageTexts, usedPlaceholders } from "./draft";

/**
 * What "Check & send" shows before a message goes out (ruling R23): one
 * rendered sample per distinct text, and the bus and room details the text
 * needs but the audience lacks (plan M5). Pure module.
 */

type Locale = "no" | "en";

/** At most this many samples. */
export const SAMPLES_MAX = 5;

const BUS_DETAILS: readonly Placeholder[] = [
  "bus",
  "bus_contact",
  "departure",
  "meeting_point",
];

const usesBus = (uses: ReadonlySet<Placeholder>): boolean =>
  BUS_DETAILS.some((key) => uses.has(key));

export interface MessageSample {
  /** The bus and/or room the sample stands for, or "Everyone". */
  label: string;
  text: Record<Locale, { body: string; title: string }>;
}

export interface SampleInput {
  labels: { everyone: string; noBus: string; noRoom: string };
  /** The admin's language, for the label. */
  locale: Locale;
  /** The audience, in order; the first person of each distinct text is shown. */
  people: { vars: LocalizedVars }[];
  texts: MessageTexts;
}

function render(texts: MessageTexts, vars: LocalizedVars, forPush: boolean) {
  const one = (locale: Locale) => ({
    body: renderText(texts.body[locale], vars[locale], { forPush }),
    title: renderText(texts.title[locale], vars[locale], { forPush }),
  });
  return { en: one("en"), no: one("no") };
}

function labelFor(
  input: SampleInput,
  uses: ReadonlySet<Placeholder>,
  vars: LocalizedVars
): string {
  const own = vars[input.locale];
  const parts: string[] = [];
  if (usesBus(uses)) {
    parts.push(own.bus ?? input.labels.noBus);
  }
  if (uses.has("room")) {
    parts.push(own.room ?? input.labels.noRoom);
  }
  return parts.length > 0 ? parts.join(" · ") : input.labels.everyone;
}

/**
 * One person per distinct text, at most five. Texts are told apart without
 * the first name (as pushes are grouped), so the samples are the buses or
 * rooms the text differs by; each is shown in full for its person.
 */
export function messageSamples(input: SampleInput): MessageSample[] {
  const uses = usedPlaceholders(input.texts);
  const seen = new Set<string>();
  const samples: MessageSample[] = [];
  for (const { vars } of input.people) {
    const key = JSON.stringify(render(input.texts, vars, true));
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    samples.push({
      label: labelFor(input, uses, vars),
      text: render(input.texts, vars, false),
    });
    if (samples.length === SAMPLES_MAX) {
      break;
    }
  }
  return samples;
}

export type WarningBus = VarsBus;

export type MessageWarning =
  | { bus: string; kind: "no_contact" | "no_departure" | "no_meeting_point" }
  | { count: number; kind: "people_without_bus" | "people_without_room" };

export interface WarningInput {
  buses: ReadonlyMap<string, WarningBus>;
  leg: GroupLeg;
  members: AudienceMember[];
  /** The people the message reaches. */
  people: Pick<BigEventParticipantRow, "$id" | "campus_id">[];
  roomIds: ReadonlySet<string>;
  uses: ReadonlySet<Placeholder>;
}

const blank = (value: string | null | undefined): boolean => !value?.trim();

const byName = new Intl.Collator("nb", { numeric: true });

/** The bus details on `leg` that the text uses and the bus lacks. */
function busGaps(
  bus: WarningBus,
  leg: GroupLeg,
  uses: ReadonlySet<Placeholder>
): MessageWarning[] {
  const out = leg === "out";
  const gaps: MessageWarning[] = [];
  if (
    uses.has("departure") &&
    blank(out ? bus.out_departs_at : bus.home_departs_at)
  ) {
    gaps.push({ bus: bus.name, kind: "no_departure" });
  }
  if (
    uses.has("meeting_point") &&
    blank(out ? bus.out_meeting_point : bus.home_meeting_point)
  ) {
    gaps.push({ bus: bus.name, kind: "no_meeting_point" });
  }
  if (
    uses.has("bus_contact") &&
    blank(bus.contact_name) &&
    blank(bus.contact_phone)
  ) {
    gaps.push({ bus: bus.name, kind: "no_contact" });
  }
  return gaps;
}

/**
 * Buses of the audience missing a detail the text uses ("Bus 3 has no
 * meeting point yet"), then how many people have no bus on the leg or no
 * room when the text names one: those details render empty for them. A
 * person's bus is a seat on the leg on a bus of their own campus, as the
 * send uses (Stage 2 ruling R19).
 */
export function messageWarnings(input: WarningInput): MessageWarning[] {
  const { buses, leg, roomIds, uses } = input;
  const campusOf = new Map(
    input.people.map((person) => [person.$id, person.campus_id])
  );
  const riders = new Set<string>();
  const roomed = new Set<string>();
  const used = new Map<string, WarningBus>();
  for (const member of input.members) {
    if (!campusOf.has(member.participant_id)) {
      continue;
    }
    if (member.leg === null) {
      if (roomIds.has(member.group_id)) {
        roomed.add(member.participant_id);
      }
      continue;
    }
    const bus = buses.get(member.group_id);
    if (
      member.leg === leg &&
      bus &&
      bus.campus_id === campusOf.get(member.participant_id)
    ) {
      riders.add(member.participant_id);
      used.set(member.group_id, bus);
    }
  }

  const warnings: MessageWarning[] = [];
  if (usesBus(uses)) {
    const ordered = [...used.values()].sort((a, b) =>
      byName.compare(a.name, b.name)
    );
    warnings.push(...ordered.flatMap((bus) => busGaps(bus, leg, uses)));
    const without = campusOf.size - riders.size;
    if (without > 0) {
      warnings.push({ count: without, kind: "people_without_bus" });
    }
  }
  if (uses.has("room") && campusOf.size > roomed.size) {
    warnings.push({
      count: campusOf.size - roomed.size,
      kind: "people_without_room",
    });
  }
  return warnings;
}

const WARNING_KEYS: Record<MessageWarning["kind"], string> = {
  no_contact: "warnings.noContact",
  no_departure: "warnings.noDeparture",
  no_meeting_point: "warnings.noMeetingPoint",
  people_without_bus: "warnings.peopleWithoutBus",
  people_without_room: "warnings.peopleWithoutRoom",
};

type Translate = (
  key: string,
  values?: Record<string, string | number>
) => string;

/** The warnings in the admin's language (`adminPortal.bigEvents.messages`). */
export function warningTexts(
  warnings: MessageWarning[],
  leg: GroupLeg,
  t: Translate
): string[] {
  return warnings.map((warning) =>
    "bus" in warning
      ? t(WARNING_KEYS[warning.kind], { bus: warning.bus, leg })
      : t(WARNING_KEYS[warning.kind], { count: warning.count, leg })
  );
}
