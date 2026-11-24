import "server-only";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { hashConnectToken } from "@repo/shared/big-events/connect-token";
import { enqueueConnectEmails } from "@repo/shared/big-events/delivery-queue";
import { BIG_EVENT_TABLES } from "@repo/shared/big-events/tables";
import type {
  BigEventParticipantRow,
  BigEventRow,
} from "@repo/shared/big-events/types";
import { getLocale } from "@/app/actions/locale";
import { getLoggedInUser } from "@/lib/actions/user";

/**
 * The "connect your ticket" page (spec D4): what a personal link shows the
 * person who opens it. Reading a link never links anything, since email
 * scanners open links too; only the page's button does (`connectTicket`).
 * The big-event tables are service-only, so everything here goes through the
 * admin client, and only after the token has picked out one participant.
 */
export type ConnectView =
  | { state: "invalid" }
  | { state: "ended" }
  | { state: "signed_out"; eventName: string }
  | { state: "needs_bi"; eventName: string }
  | {
      state: "confirm";
      accountEmail: string;
      eventName: string;
      holderName: string;
    }
  | { state: "connected"; eventName: string; slug: string }
  | { state: "linked_to_other" }
  | { state: "account_has_ticket"; eventName: string };

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

/** What connecting needs; only there when the view is `confirm`. */
export interface ConnectTarget {
  db: AdminDb;
  participant: BigEventParticipantRow;
  userId: string;
}

export interface ConnectContext {
  target: ConnectTarget | null;
  view: ConnectView;
}

const DATABASE_ID = "app";
const EVENTS = BIG_EVENT_TABLES.events;
const PARTICIPANTS = BIG_EVENT_TABLES.participants;
/** `deriveConnectToken` output: a SHA-256 HMAC in base64url. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** More tickets than one person could have bought on one address. */
const MAX_PEOPLE_PER_ADDRESS = 100;

const INVALID: ConnectContext = { target: null, view: { state: "invalid" } };

/** The page a connect link opens; the sign-in returns here too. */
export function connectPath(token: string): string {
  return `/connect/${token}`;
}

function isLive(event: BigEventRow, now: Date): boolean {
  return (
    event.status === "published" && Date.parse(event.ends_at) > now.getTime()
  );
}

async function findEvent(
  db: AdminDb,
  bigEventId: string
): Promise<BigEventRow | null> {
  const { rows } = await db.listRows<BigEventRow>(DATABASE_ID, EVENTS, [
    Query.equal("$id", [bigEventId]),
    Query.limit(1),
  ]);
  return rows[0] ?? null;
}

async function findParticipant(
  db: AdminDb,
  token: string
): Promise<BigEventParticipantRow | null> {
  const { rows } = await db.listRows<BigEventParticipantRow>(
    DATABASE_ID,
    PARTICIPANTS,
    [
      Query.equal("connect_token_hash", [hashConnectToken(token)]),
      Query.limit(1),
    ]
  );
  return rows[0] ?? null;
}

/** Whether the account already holds a ticket in this big event. */
async function accountHasTicket(
  db: AdminDb,
  bigEventId: string,
  userId: string
): Promise<boolean> {
  const { rows } = await db.listRows<BigEventParticipantRow>(
    DATABASE_ID,
    PARTICIPANTS,
    [
      Query.equal("big_event_id", [bigEventId]),
      Query.equal("user_id", [userId]),
      Query.select(["$id"]),
      Query.limit(1),
    ]
  );
  return rows.length > 0;
}

function holderName(participant: BigEventParticipantRow): string {
  return [participant.first_name, participant.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * The link's view for whoever is signed in, plus what connecting needs when
 * the answer is "confirm". The order matters: someone opening their own,
 * already-used link sees the event even before the BI check, and a non-BI
 * account is asked to sign in with BI before learning anything about who
 * holds the ticket.
 */
export async function readConnectContext(
  token: string,
  now: Date = new Date()
): Promise<ConnectContext> {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
    return INVALID;
  }
  const { db } = await createAdminClient();
  const participant = await findParticipant(db, token);
  const event = participant
    ? await findEvent(db, participant.big_event_id)
    : null;
  if (!(participant && event?.status === "published")) {
    return INVALID;
  }
  if (!isLive(event, now)) {
    return { target: null, view: { state: "ended" } };
  }

  const [session, locale] = await Promise.all([getLoggedInUser(), getLocale()]);
  const eventName =
    locale === "en" ? event.name_en?.trim() || event.name_no : event.name_no;
  if (!session) {
    return { target: null, view: { eventName, state: "signed_out" } };
  }
  const { profile, user } = session;
  if (participant.user_id === user.$id) {
    return {
      target: null,
      view: { eventName, slug: event.slug, state: "connected" },
    };
  }
  if (!profile?.student_id?.trim()) {
    return { target: null, view: { eventName, state: "needs_bi" } };
  }
  if (participant.user_id) {
    return { target: null, view: { state: "linked_to_other" } };
  }
  if (await accountHasTicket(db, event.$id, user.$id)) {
    return { target: null, view: { eventName, state: "account_has_ticket" } };
  }
  return {
    target: { db, participant, userId: user.$id },
    view: {
      accountEmail: user.email,
      eventName,
      holderName: holderName(participant),
      state: "confirm",
    },
  };
}

/** What `/connect/<token>` shows. Never links. */
export async function resolveConnectToken(token: string): Promise<ConnectView> {
  return (await readConnectContext(token)).view;
}

/**
 * "Didn't get the email?": queues a new connect email to `address` (already
 * trimmed and lowercased, like imported ticket emails) for each of its
 * unlinked participants in published big events that have not ended. People
 * sharing the address share one email. Returns how many people were queued.
 */
export async function queueConnectLinks(
  db: AdminDb,
  address: string,
  now: Date = new Date()
): Promise<number> {
  const { rows } = await db.listRows<BigEventParticipantRow>(
    DATABASE_ID,
    PARTICIPANTS,
    [
      Query.equal("ticket_email", [address]),
      Query.isNull("user_id"),
      Query.limit(MAX_PEOPLE_PER_ADDRESS),
    ]
  );
  const byEvent = new Map<string, BigEventParticipantRow[]>();
  for (const person of rows) {
    byEvent.set(person.big_event_id, [
      ...(byEvent.get(person.big_event_id) ?? []),
      person,
    ]);
  }

  let queued = 0;
  for (const [bigEventId, participants] of byEvent) {
    const event = await findEvent(db, bigEventId);
    if (!(event && isLive(event, now))) {
      continue;
    }
    const result = await enqueueConnectEmails(db, {
      bigEventId,
      kind: "connect",
      participants,
    });
    queued += result.queued;
  }
  return queued;
}
