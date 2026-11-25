import type { SuggestionReason } from "@repo/shared/big-events/tables";
import type { BigEventParticipantRow } from "@repo/shared/big-events/types";
import type { ReachPile } from "./reach";

/** A "possible match" as the organizer sees it: who, and why. Never the account id. */
export interface ParticipantSuggestion {
  email: string | null;
  name: string;
  reason: SuggestionReason;
}

/** What the tab adds to a participant row. */
export interface ParticipantListExtras {
  accountEmail: string | null;
  accountName: string | null;
  /** The bus they ride out on (its name); null when on none or Travel is off. */
  busName: string | null;
  /** The bus home, only when it differs from the way out. */
  homeBusName: string | null;
  /** Unlinked, emailed once, and the link was cleared when their email changed. */
  needsNewLink: boolean;
  pile: ReachPile;
  /** The room's name (the buyer's name); null when not in a room. */
  roomName: string | null;
  /** A possible account for an unlinked person, resolved on the server. */
  suggestion: ParticipantSuggestion | null;
}

/**
 * A participant as the participants tab gets it: only the columns it shows or
 * the edit dialog changes. Suggestions, import bookkeeping and connect tokens
 * stay on the server.
 */
export type ParticipantListItem = Pick<
  BigEventParticipantRow,
  | "$id"
  | "campus_id"
  | "connect_sent_at"
  | "first_name"
  | "last_name"
  | "membership_valid"
  | "phone"
  | "ticket_email"
  | "user_id"
> &
  ParticipantListExtras;

/** Not connected and has a ticket email: someone a connect email can reach. */
export function canSendConnectEmail(
  row: Pick<ParticipantListItem, "ticket_email" | "user_id">
): boolean {
  return !row.user_id && Boolean(row.ticket_email);
}

/**
 * Who a toolbar send reaches (ruling R37): `new` is everyone a connect email
 * can reach who has never had one; `all` is everyone it can reach, emailed
 * before or not.
 */
export const CONNECT_SEND_MODES = ["new", "all"] as const;
export type ConnectSendMode = (typeof CONNECT_SEND_MODES)[number];

export function isConnectTarget(
  row: Pick<
    ParticipantListItem,
    "connect_sent_at" | "ticket_email" | "user_id"
  >,
  mode: ConnectSendMode
): boolean {
  return canSendConnectEmail(row) && (mode === "all" || !row.connect_sent_at);
}

/** The emails a send goes out as: one per ticket address. */
export function connectEmailCount(
  rows: Pick<ParticipantListItem, "ticket_email">[]
): number {
  return new Set(
    rows.flatMap((row) => {
      const address = row.ticket_email?.trim().toLowerCase();
      return address ? [address] : [];
    })
  ).size;
}

/**
 * Their email changed after a connect email went out, which cleared the link:
 * unlinked, has an address, was sent once, and no link is live now.
 */
export function needsNewConnectLink(
  row: Pick<
    BigEventParticipantRow,
    "connect_sent_at" | "connect_token_hash" | "ticket_email" | "user_id"
  >
): boolean {
  return (
    !row.user_id &&
    Boolean(row.ticket_email) &&
    Boolean(row.connect_sent_at) &&
    !row.connect_token_hash
  );
}

/** Copies only the columns the tab may see; never spread a whole row into the browser. */
export function toParticipantListItem(
  row: BigEventParticipantRow,
  extras: ParticipantListExtras
): ParticipantListItem {
  return {
    $id: row.$id,
    campus_id: row.campus_id,
    connect_sent_at: row.connect_sent_at,
    first_name: row.first_name,
    last_name: row.last_name,
    membership_valid: row.membership_valid,
    phone: row.phone,
    ticket_email: row.ticket_email,
    user_id: row.user_id,
    ...extras,
  };
}

export interface ParticipantList {
  counts: Record<ReachPile, number>;
  /** Whether the big event has Travel on, so buses are shown. */
  hasBuses: boolean;
  /** Whether the big event has any rooms at all. */
  hasRooms: boolean;
  /** Visible participants without a campus. */
  noCampus: number;
  rows: ParticipantListItem[];
}

export type PileFilter = ReachPile | "all";

export const ALL_CAMPUSES = "all";
export const NO_CAMPUS = "none";

export interface ParticipantFilters {
  /** A campus id, `ALL_CAMPUSES` or `NO_CAMPUS`. */
  campus: string;
  /** Only people whose connect link was cleared after an earlier send. */
  needsNewLink: boolean;
  /** Only people with no bus out. */
  noBus: boolean;
  noRoom: boolean;
  pile: PileFilter;
  search: string;
}

export function participantName(
  row: Pick<BigEventParticipantRow, "first_name" | "last_name">
): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ");
}

/** Where an email reaches the person: their account when connected, else the ticket. */
export function participantEmail(
  row: Pick<ParticipantListItem, "accountEmail" | "ticket_email">
): string | null {
  return row.accountEmail ?? row.ticket_email;
}

function matchesCampus(row: ParticipantListItem, campus: string): boolean {
  if (campus === ALL_CAMPUSES) {
    return true;
  }
  if (campus === NO_CAMPUS) {
    return row.campus_id === null;
  }
  return row.campus_id === campus;
}

function matchesSearch(row: ParticipantListItem, search: string): boolean {
  if (search === "") {
    return true;
  }
  return [
    participantName(row),
    row.ticket_email,
    row.accountEmail,
    row.accountName,
  ].some((text) => text?.toLocaleLowerCase("nb").includes(search));
}

export function filterParticipants(
  rows: ParticipantListItem[],
  filters: ParticipantFilters
): ParticipantListItem[] {
  const search = filters.search.trim().toLocaleLowerCase("nb");
  return rows.filter(
    (row) =>
      (filters.pile === "all" || row.pile === filters.pile) &&
      matchesCampus(row, filters.campus) &&
      !(filters.noRoom && row.roomName !== null) &&
      !(filters.noBus && row.busName !== null) &&
      !(filters.needsNewLink && !row.needsNewLink) &&
      matchesSearch(row, search)
  );
}

/** Each person's email (see `participantEmail`), every address once. */
export function uniqueEmails(rows: ParticipantListItem[]): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const row of rows) {
    const email = participantEmail(row);
    const key = email?.toLowerCase();
    if (email && key && !seen.has(key)) {
      seen.add(key);
      emails.push(email);
    }
  }
  return emails;
}

/** Alphabetical by first and last name, the Norwegian way (æ, ø, å last). */
export function sortParticipants<
  T extends Pick<BigEventParticipantRow, "first_name" | "last_name">,
>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    participantName(a).localeCompare(participantName(b), "nb")
  );
}
