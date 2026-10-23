import { createAdminClient } from "@repo/api/server";
import { createRateLimiter } from "@repo/shared/member-pass/rate-limit";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders } from "@/lib/cors";
import {
  applyNotificationState,
  type NotificationStateAction,
  type NotificationStateDb,
  parseAnnouncementIds,
} from "@/lib/notification-state";

const DATABASE_ID = "app";
const REQUESTS_PER_MINUTE = 60;
const ONE_MINUTE_MS = 60 * 1000;

// Per user id, per server instance, shared by reads and clears.
const stateRateLimiter = createRateLimiter({
  limit: REQUESTS_PER_MINUTE,
  windowMs: ONE_MINUTE_MS,
});

function json(body: unknown, origin: string | null, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

/** The state helper's database, bound to the "app" database with admin rights. */
async function createStateDb(): Promise<NotificationStateDb> {
  const { db } = await createAdminClient();
  return {
    createRow: (table, id, data, permissions) =>
      db.createRow(DATABASE_ID, table, id, data, permissions),
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

/**
 * The handler behind `POST /api/notifications/read` and `/clear`: saves
 * [action] on the announcements in the body for the account the bearer token
 * belongs to. The `user_notifications` table gives clients no write access,
 * so this is the app's only way to record what a student read or cleared.
 */
export function notificationStateRoute(action: NotificationStateAction) {
  return async (req: NextRequest) => {
    const origin = req.headers.get("origin");
    if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
      return json({ error: "not_authenticated" }, origin, 401);
    }

    let userId: string;
    try {
      const { account } = await createAuthenticatedClient(req);
      userId = (await account.get()).$id;
    } catch {
      return json({ error: "not_authenticated" }, origin, 401);
    }

    const announcementIds = parseAnnouncementIds(
      await req.json().catch(() => null)
    );
    if (!announcementIds) {
      return json({ error: "invalid_request" }, origin, 400);
    }
    if (!stateRateLimiter(userId)) {
      return json({ error: "rate_limited" }, origin, 429);
    }

    try {
      await applyNotificationState(await createStateDb(), {
        action,
        announcementIds,
        userId,
      });
      return json({ ok: true }, origin);
    } catch (error) {
      console.error(
        `[Notifications] Saving ${action} failed:`,
        errorSummary(error)
      );
      return json({ error: "unavailable" }, origin, 503);
    }
  };
}
