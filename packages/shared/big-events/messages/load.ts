import "server-only";

/**
 * The loading step of the send engine (send.ts): the big event, who the
 * message reaches (plan M7) with their details on the message's leg (M5),
 * and how each person gets it (M3).
 */

import { type Models, Query, type TablesDB } from "@repo/api";
import { BIG_EVENT_TABLES } from "../tables";
import type {
  BigEventGroupMemberRow,
  BigEventGroupRow,
  BigEventMessageRow,
  BigEventParticipantRow,
  BigEventRow,
} from "../types";
import { type Audience, resolveAudience } from "./audience";
import {
  deliveryRecipients,
  type PlannedRecipient,
  planDelivery,
  type RecipientAccount,
} from "./plan";
import { pushTargetUsers, type UsersApi } from "./push-targets";

const DB = "app";
const USER_TABLE = "user";
const PAGE_SIZE = 500;
/** Appwrite refuses an `equal` query with more values than this. */
const MAX_QUERY_VALUES = 100;

type AccountRow = Models.Row & RecipientAccount;

export interface LoadedDelivery {
  event: BigEventRow;
  planned: PlannedRecipient[];
}

/** Every row matching `queries`, a page at a time. */
export async function listAll<T extends Models.Row>(
  db: TablesDB,
  table: string,
  queries: string[]
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  while (true) {
    const page = [...queries, Query.limit(PAGE_SIZE)];
    if (cursor) {
      page.push(Query.cursorAfter(cursor));
    }
    const { rows } = await db.listRows<T>(DB, table, page);
    all.push(...rows);
    if (rows.length < PAGE_SIZE) {
      return all;
    }
    cursor = rows.at(-1)?.$id;
  }
}

/** The stored audience; a message without a readable one can't be sent. */
function parseAudience(raw: string | null): Audience {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    // Reported below.
  }
  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
    throw new Error("The message's audience can't be read.");
  }
  return parsed as Audience;
}

async function loadAccounts(
  db: TablesDB,
  userIds: string[]
): Promise<AccountRow[]> {
  const accounts: AccountRow[] = [];
  for (let start = 0; start < userIds.length; start += MAX_QUERY_VALUES) {
    const chunk = userIds.slice(start, start + MAX_QUERY_VALUES);
    const { rows } = await db.listRows<AccountRow>(DB, USER_TABLE, [
      Query.equal("$id", chunk),
      Query.select(["$id", "email", "locale"]),
      Query.limit(chunk.length),
    ]);
    accounts.push(...rows);
  }
  return accounts;
}

/**
 * Who the message reaches and how: the audience within the message's
 * campuses (`campus_ids`, or every campus when empty), each person's details
 * in both languages (Stage 3 ruling R6) and their channels. `sms`: the SMS
 * switch is on and the message asks for an SMS.
 */
export async function loadDelivery(
  deps: { db: TablesDB; users: UsersApi },
  message: BigEventMessageRow,
  sms: boolean
): Promise<LoadedDelivery> {
  const { db } = deps;
  const byEvent = [Query.equal("big_event_id", message.big_event_id)];
  const [event, participants, groups, members] = await Promise.all([
    db.getRow<BigEventRow>(DB, BIG_EVENT_TABLES.events, message.big_event_id),
    listAll<BigEventParticipantRow>(db, BIG_EVENT_TABLES.participants, byEvent),
    listAll<BigEventGroupRow>(db, BIG_EVENT_TABLES.groups, byEvent),
    listAll<BigEventGroupMemberRow>(db, BIG_EVENT_TABLES.groupMembers, byEvent),
  ]);
  const buses = new Map(
    groups.filter((group) => group.kind === "bus").map((g) => [g.$id, g])
  );
  const rooms = new Map(
    groups.filter((group) => group.kind === "room").map((g) => [g.$id, g])
  );

  const campusIds = message.campus_ids ?? [];
  const stored = parseAudience(message.audience);
  // One leg for who gets it and whose details they get (ruling R13).
  const leg =
    message.leg ?? (stored.type === "groups" ? stored.leg : undefined) ?? "out";
  const audience: Audience =
    stored.type === "groups" ? { ...stored, leg } : stored;
  const reached = resolveAudience({
    allowedCampusIds: campusIds.length > 0 ? campusIds : "all",
    audience,
    buses,
    members,
    participants,
  });
  const byId = new Map(participants.map((person) => [person.$id, person]));
  const people = reached.flatMap((id) => {
    const person = byId.get(id);
    return person ? [person] : [];
  });

  const linked = [
    ...new Set(
      people.flatMap((person) => (person.user_id ? [person.user_id] : []))
    ),
  ];
  const [accounts, pushUsers] = await Promise.all([
    loadAccounts(db, linked),
    pushTargetUsers(deps.users, linked),
  ]);

  return {
    event,
    planned: planDelivery({
      important: Boolean(message.important),
      pushUsers,
      recipients: deliveryRecipients({
        accounts,
        buses,
        leg,
        members,
        people,
        rooms,
      }),
      sms,
    }),
  };
}
