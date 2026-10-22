import { createAdminClient } from "@repo/api/server";
import { createRateLimiter } from "@repo/shared/member-pass/rate-limit";
import {
  type RevealDb,
  revealBenefitCode,
} from "@repo/shared/utils/benefit-reveal-server";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { resolveMemberPassForRequest } from "@/lib/member-pass/resolve";

export const dynamic = "force-dynamic";

const DATABASE_ID = "app";
const REVEAL_LIMIT_PER_MINUTE = 30;
const ONE_MINUTE_MS = 60 * 1000;
// Appwrite custom ids: up to 36 chars of [a-zA-Z0-9._-], not starting with a symbol.
const BENEFIT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

// Per user id, per server instance.
const revealRateLimiter = createRateLimiter({
  limit: REVEAL_LIMIT_PER_MINUTE,
  windowMs: ONE_MINUTE_MS,
});

function json(body: unknown, origin: string | null, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

/** The reveal helper's database, bound to the "app" database with admin rights. */
async function createRevealDb(): Promise<RevealDb> {
  const { db } = await createAdminClient();
  return {
    createRow: (table, id, data, permissions) =>
      db.createRow(DATABASE_ID, table, id, data, permissions),
    getRow: <T>(table: string, id: string) =>
      db.getRow(DATABASE_ID, table, id) as unknown as Promise<T>,
    listRows: <T>(table: string, queries: string[]) =>
      db.listRows(DATABASE_ID, table, queries) as unknown as Promise<{
        rows: T[];
      }>,
  };
}

/** Only the error's status code and type: a message or row could carry a code. */
function errorSummary(error: unknown): string {
  const { code, type } = (error ?? {}) as { code?: unknown; type?: unknown };
  return `code=${String(code ?? "")} type=${String(type ?? "")}`;
}

/**
 * Reveals a benefit's code or link to an active member. Membership is
 * resolved first (a live check); non-members and outages return before any
 * benefit or code row is read. Only active members are rate limited here;
 * the resolver's membership cache bounds the cost of the rest.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = req.headers.get("origin");
  const resolved = await resolveMemberPassForRequest(req);
  if (resolved.state === "unauthenticated") {
    return json({ error: "not_authenticated" }, origin, 401);
  }
  if (resolved.state === "unavailable") {
    return json({ error: "membership_unavailable" }, origin, 503);
  }
  if (resolved.state !== "active") {
    return json({ error: "not_member" }, origin, 403);
  }

  const { id } = await params;
  if (!BENEFIT_ID_RE.test(id)) {
    return json({ error: "not_found" }, origin, 404);
  }
  if (!revealRateLimiter(resolved.userId)) {
    return json({ error: "rate_limited" }, origin, 429);
  }

  try {
    const result = await revealBenefitCode(await createRevealDb(), {
      benefitId: id,
      membership: "active",
      now: new Date(),
      userId: resolved.userId,
    });
    if (result.ok) {
      return json({ value: result.value }, origin);
    }
    switch (result.reason) {
      case "not_found":
        return json({ error: "not_found" }, origin, 404);
      case "no_code":
        return json({ error: "no_code" }, origin, 409);
      case "not_member":
        return json({ error: "not_member" }, origin, 403);
      default:
        return json({ error: "membership_unavailable" }, origin, 503);
    }
  } catch (error) {
    console.error("[Benefits] Reveal failed:", errorSummary(error));
    return json({ error: "unavailable" }, origin, 503);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
