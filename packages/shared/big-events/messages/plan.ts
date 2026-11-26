/**
 * How a big event message reaches each person: their own details for the
 * placeholders (plan M5) and the channels it goes out on (plan M3, spec D6).
 * Pure module (no Appwrite).
 */

import { formatOsloDate, formatOsloTime } from "../../utils/oslo-time";
import { normalizePhone } from "../phone";
import type { GroupLeg } from "../tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventParticipantRow,
} from "../types";
import type { MessageVars } from "./text";

type Locale = "no" | "en";

// ── Per-person details ────────────────────────────────────────────────────────

export type VarsBus = Pick<
  BigEventGroupRow,
  | "campus_id"
  | "contact_name"
  | "contact_phone"
  | "home_departs_at"
  | "home_meeting_point"
  | "name"
  | "out_departs_at"
  | "out_meeting_point"
>;
export type VarsRoom = Pick<BigEventGroupRow, "name" | "room_number">;

export interface VarsInput {
  /** Bus groups by id. */
  buses: ReadonlyMap<string, VarsBus>;
  leg: GroupLeg;
  locale: Locale;
  /** Group places; other people's places are ignored. */
  members: Pick<
    BigEventGroupMemberRow,
    "group_id" | "leg" | "participant_id"
  >[];
  participant: Pick<BigEventParticipantRow, "$id" | "campus_id" | "first_name">;
  /** Room groups by id. */
  rooms: ReadonlyMap<string, VarsRoom>;
}

const DEPARTURE_DAY: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  weekday: "short",
};
const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", no: "nb-NO" };
const ROOM_PREFIX: Record<Locale, string> = { en: "Room", no: "Rom" };

/** "fre. 24. jan. kl. 14:00" / "Fri 24 Jan, 14:00" in Oslo time. */
function formatDeparture(
  value: string | null,
  locale: Locale
): string | undefined {
  const day = formatOsloDate(value, DEPARTURE_DAY, INTL_LOCALE[locale]);
  const time = formatOsloTime(value);
  if (!(day && time)) {
    return;
  }
  return locale === "no" ? `${day} kl. ${time}` : `${day}, ${time}`;
}

/** "Kari Nordmann, 912 34 567" (the phone as stored), or whichever part is set. */
function formatContact(bus: VarsBus): string | undefined {
  const parts = [bus.contact_name, bus.contact_phone]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function present(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Drops keys without a value, so missing details render as nothing. */
function compact(vars: MessageVars): MessageVars {
  const out: MessageVars = {};
  for (const [key, value] of Object.entries(vars) as [
    keyof MessageVars,
    string | undefined,
  ][]) {
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * One person's placeholder values for a message on `leg`: their own bus seat
 * on that leg and their room. A seat on another campus's bus is never named
 * (Stage 2 ruling R19). Missing details are left out (they render as nothing).
 */
export function varsFor(input: VarsInput): MessageVars {
  const { buses, leg, locale, participant, rooms } = input;
  let bus: VarsBus | undefined;
  let room: VarsRoom | undefined;
  for (const member of input.members) {
    if (member.participant_id !== participant.$id) {
      continue;
    }
    if (member.leg === null) {
      room ??= rooms.get(member.group_id);
    } else if (member.leg === leg && !bus) {
      const seat = buses.get(member.group_id);
      if (seat && seat.campus_id === participant.campus_id) {
        bus = seat;
      }
    }
  }

  const roomName =
    room &&
    (present(room.room_number) ?? `${ROOM_PREFIX[locale]} · ${room.name}`);

  return compact({
    bus: present(bus?.name),
    bus_contact: bus && formatContact(bus),
    departure:
      bus &&
      formatDeparture(
        leg === "out" ? bus.out_departs_at : bus.home_departs_at,
        locale
      ),
    first_name: present(participant.first_name),
    meeting_point: present(
      leg === "out" ? bus?.out_meeting_point : bus?.home_meeting_point
    ),
    room: roomName,
  });
}

// ── Delivery plan ─────────────────────────────────────────────────────────────

/**
 * A person's placeholder values in each language: the departure date and the
 * room fallback are worded per language (Stage 3 ruling R6).
 */
export type LocalizedVars = Record<Locale, MessageVars>;

/** Size of `big_event_message_recipients.vars`. */
const STORED_VARS_MAX = 1000;
const ELLIPSIS = "…";

function capValues(vars: MessageVars, cap: number): MessageVars {
  const out: MessageVars = {};
  for (const [key, value] of Object.entries(vars) as [
    keyof MessageVars,
    string | undefined,
  ][]) {
    if (value !== undefined) {
      out[key] =
        value.length > cap ? `${value.slice(0, cap - 1)}${ELLIPSIS}` : value;
    }
  }
  return out;
}

/**
 * The JSON for a recipient row's `vars`. When the details are too long for
 * the column, the longest values are cut to one shared length (ending in
 * "…") so everything shorter stays whole.
 */
export function serializeVars(vars: LocalizedVars): string {
  const full = JSON.stringify(vars);
  if (full.length <= STORED_VARS_MAX) {
    return full;
  }
  const capped = (cap: number) =>
    JSON.stringify({
      en: capValues(vars.en, cap),
      no: capValues(vars.no, cap),
    });
  // The longest cap that fits; a cap of one ("…") always does.
  let fits = capped(1);
  let low = 2;
  let high = Math.max(
    ...[...Object.values(vars.en), ...Object.values(vars.no)].map(
      (value) => value?.length ?? 0
    )
  );
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const json = capped(mid);
    if (json.length <= STORED_VARS_MAX) {
      fits = json;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return fits;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVars(value: unknown): value is MessageVars {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

/** A recipient row's `vars`, or null when it is missing or not readable. */
export function parseStoredVars(json: string | null): LocalizedVars | null {
  if (!json) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (isRecord(parsed) && isVars(parsed.no) && isVars(parsed.en)) {
    return { en: parsed.en, no: parsed.no };
  }
  return null;
}

export interface DeliveryRecipient {
  participant: Pick<
    BigEventParticipantRow,
    "$id" | "phone" | "ticket_email" | "user_id"
  >;
  /** The linked account's email, if any. */
  userEmail: string | null;
  /** The linked account's language, if any. */
  userLocale: Locale | null;
  vars: LocalizedVars;
}

export interface PlannedRecipient {
  email: boolean;
  /** The address the email goes to (null when no email is sent). */
  emailTo: string | null;
  /** Language of the push/email; null for unlinked people (both, Norwegian first). */
  locale: Locale | null;
  participantId: string;
  push: boolean;
  sms: boolean;
  smsTo: string | null;
  userId: string | null;
  vars: LocalizedVars;
}

export interface PlanDeliveryInput {
  important: boolean;
  /** Linked accounts that have a push target. */
  pushUsers: Set<string>;
  recipients: DeliveryRecipient[];
  /** The SMS switch is on and the message asks for an SMS. */
  sms: boolean;
}

function plannedFor(
  recipient: DeliveryRecipient,
  input: PlanDeliveryInput
): PlannedRecipient {
  const { participant } = recipient;
  const userId = participant.user_id || null;
  const push = userId !== null && input.pushUsers.has(userId);
  const address =
    present(participant.ticket_email) ?? present(recipient.userEmail) ?? null;
  const email = address !== null && (input.important || !push);
  const phone = input.sms ? normalizePhone(participant.phone) : null;
  let locale: Locale | null = null;
  if (userId !== null) {
    locale = recipient.userLocale === "no" ? "no" : "en";
  }
  return {
    email,
    emailTo: email ? address : null,
    locale,
    participantId: participant.$id,
    push,
    sms: phone !== null,
    smsTo: phone,
    userId,
    vars: recipient.vars,
  };
}

/**
 * The delivery rule (plan M3, spec D6): a push when the person is linked and
 * the account has a push target; otherwise an email to the ticket address,
 * else the account email. Important messages go as push and email. With
 * `sms`, everyone with a phone also gets an SMS. Each person is planned once,
 * so nobody gets the same message twice on one channel.
 */
export function planDelivery(input: PlanDeliveryInput): PlannedRecipient[] {
  const seen = new Set<string>();
  const planned: PlannedRecipient[] = [];
  for (const recipient of input.recipients) {
    if (seen.has(recipient.participant.$id)) {
      continue;
    }
    seen.add(recipient.participant.$id);
    planned.push(plannedFor(recipient, input));
  }
  return planned;
}

export interface ReachSummary {
  email: number;
  people: number;
  push: number;
  sms: number;
  /** People who get neither a push nor an email. */
  unreachable: number;
}

/**
 * The reach box counts. An SMS doesn't make someone reachable: no SMS
 * provider exists yet and SMS rows are marked not sent (spec D9).
 */
export function reachSummary(planned: PlannedRecipient[]): ReachSummary {
  const summary: ReachSummary = {
    email: 0,
    people: planned.length,
    push: 0,
    sms: 0,
    unreachable: 0,
  };
  for (const recipient of planned) {
    summary.push += Number(recipient.push);
    summary.email += Number(recipient.email);
    summary.sms += Number(recipient.sms);
    summary.unreachable += Number(!(recipient.push || recipient.email));
  }
  return summary;
}
