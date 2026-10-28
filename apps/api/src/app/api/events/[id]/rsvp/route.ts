import { createAdminClient } from "@repo/api/server";
import { createRateLimiter } from "@repo/shared/member-pass/rate-limit";
import { isAuthenticatedAppwriteUser } from "@repo/shared/recruitment";
import {
  type EventRsvpDb,
  parseEventRsvpStatus,
  readEventRsvp,
  setEventRsvp,
} from "@repo/shared/utils/event-rsvp";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { isMemberByProfile } from "@/lib/member-by-profile";

export const dynamic = "force-dynamic";

const DATABASE_ID = "app";
const RSVP_LIMIT_PER_MINUTE = 30;
const ONE_MINUTE_MS = 60 * 1000;
// Appwrite custom ids: up to 36 chars of [a-zA-Z0-9._-], not starting with a symbol.
const EVENT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

// Per user id, per server instance.
const rsvpRateLimiter = createRateLimiter({
  limit: RSVP_LIMIT_PER_MINUTE,
  windowMs: ONE_MINUTE_MS,
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

function json(body: unknown, origin: string | null, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

/** The RSVP helper's database, bound to the "app" database with admin rights. */
async function createRsvpDb(): Promise<EventRsvpDb> {
  const { db } = await createAdminClient();
  return {
    createRow: (table, id, data, permissions) =>
      db.createRow(DATABASE_ID, table, id, data, permissions),
    deleteRow: (table, id) => db.deleteRow(DATABASE_ID, table, id),
    listRows: <T>(table: string, queries: string[]) =>
      db.listRows(DATABASE_ID, table, queries) as unknown as Promise<{
        rows: T[];
      }>,
    updateRow: (table, id, data) => db.updateRow(DATABASE_ID, table, id, data),
  };
}

/** Only the error's status code and type: never the ids it was about. */
function errorSummary(error: unknown): string {
  const { code, type } = (error ?? {}) as { code?: unknown; type?: unknown };
  return `code=${String(code ?? "")} type=${String(type ?? "")}`;
}

type Caller =
  | { ok: true; userId: string | null }
  | { ok: false; reason: "refused" };

/** The account behind an optional bearer token; anonymous accounts count as signed out. */
async function readCaller(req: NextRequest): Promise<Caller> {
  if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
    return { ok: true, userId: null };
  }
  try {
    const { account } = await createAuthenticatedClient(req);
    const user = await account.get();
    return {
      ok: true,
      userId: isAuthenticatedAppwriteUser(user) ? user.$id : null,
    };
  } catch {
    return { ok: false, reason: "refused" };
  }
}

/**
 * Counts and the caller's own answer for an event. The token is optional so
 * signed-out students still see how many are going; a token that Appwrite
 * refuses is a 401 so the app can re-authenticate instead of silently
 * showing "no answer".
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const origin = req.headers.get("origin");
  const { id } = await params;
  if (!EVENT_ID_RE.test(id)) {
    return json({ error: "not_found" }, origin, 404);
  }
  const caller = await readCaller(req);
  if (!caller.ok) {
    return json({ error: "not_authenticated" }, origin, 401);
  }

  try {
    const summary = await readEventRsvp(await createRsvpDb(), {
      eventId: id,
      now: new Date(),
      userId: caller.userId,
    });
    if (!summary) {
      return json({ error: "not_found" }, origin, 404);
    }
    return json(summary, origin);
  } catch (error) {
    console.error("[Events] Reading RSVP failed:", errorSummary(error));
    return json({ error: "unavailable" }, origin, 503);
  }
}

/**
 * Saves (or clears, with `status: null`) the caller's answer. A bearer token
 * from a real account is required: answers belong to a person, and the
 * `event_rsvps` table gives clients no write access, so this is the app's
 * only way to record one. Member-only events are checked live.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const origin = req.headers.get("origin");
  const { id } = await params;
  if (!EVENT_ID_RE.test(id)) {
    return json({ error: "not_found" }, origin, 404);
  }
  const caller = await readCaller(req);
  if (!(caller.ok && caller.userId)) {
    return json({ error: "not_authenticated" }, origin, 401);
  }
  const { userId } = caller;

  const body = (await req.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  const status =
    body !== null && typeof body === "object" && "status" in body
      ? parseEventRsvpStatus(body.status)
      : undefined;
  if (status === undefined) {
    return json({ error: "invalid_request" }, origin, 400);
  }
  if (!rsvpRateLimiter(userId)) {
    return json({ error: "rate_limited" }, origin, 429);
  }

  try {
    const result = await setEventRsvp(await createRsvpDb(), {
      eventId: id,
      isMember: () => isMemberByProfile(userId),
      now: new Date(),
      status,
      userId,
    });
    if (result.ok) {
      return json(result.summary, origin);
    }
    switch (result.reason) {
      case "not_found":
        return json({ error: "not_found" }, origin, 404);
      case "closed":
        return json({ error: "closed" }, origin, 409);
      default:
        return json({ error: "members_only" }, origin, 403);
    }
  } catch (error) {
    console.error("[Events] Saving RSVP failed:", errorSummary(error));
    return json({ error: "unavailable" }, origin, 503);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
