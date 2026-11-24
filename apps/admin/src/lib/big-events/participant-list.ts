import type { BigEventParticipantRow } from "@repo/shared/big-events/types";
import type { ReachPile } from "./reach";

/** A participant as the participants tab gets it. Connect-token columns stay on the server. */
export type ParticipantListItem = Omit<
  BigEventParticipantRow,
  "connect_nonce" | "connect_token_hash"
> & {
  accountEmail: string | null;
  accountName: string | null;
  pile: ReachPile;
  /** The room's name (the buyer's name); null when not in a room. */
  roomName: string | null;
};

export interface ParticipantList {
  counts: Record<ReachPile, number>;
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
