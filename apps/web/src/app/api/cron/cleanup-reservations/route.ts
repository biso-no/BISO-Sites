import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";
import { cleanupAllExpiredReservations } from "@/app/actions/cart-reservations";
import { isProd } from "@/lib/utils";

/**
 * Cleanup endpoint for expired cart reservations. Driven on a schedule by the
 * `scheduled-dispatch` Appwrite Function (see `functions/scheduled-dispatch`),
 * which POSTs with an `x-cron-secret` header. Can also be hit manually with a
 * `Authorization: Bearer ${CRON_SECRET}` header.
 *
 * Recommended schedule: every 10-15 minutes (matches the 10-minute reservation
 * hold, so freed stock surfaces quickly).
 *
 * Authentication: requires `CRON_SECRET` via either `x-cron-secret` or
 * `Authorization: Bearer`. In production the route refuses to run if
 * CRON_SECRET is unset; outside production it allows unauthenticated calls so
 * local dev / smoke tests don't need the secret configured.
 */
function isAuthorized(request: Request, cronSecret: string): boolean {
  const headerSecret = request.headers.get("x-cron-secret");
  if (safeSecretCompare(headerSecret, cronSecret)) {
    return true;
  }
  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return safeSecretCompare(bearer, cronSecret);
}

async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (isProd && !cronSecret) {
    console.error("CRON_SECRET is not configured in production");
    return NextResponse.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (cronSecret && !isAuthorized(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deletedCount = await cleanupAllExpiredReservations();

    return NextResponse.json(
      {
        success: true,
        message: `Cleaned up ${deletedCount} expired reservations`,
        deletedCount,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error in cleanup-reservations cron:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cleanup reservations" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
