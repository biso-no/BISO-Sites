import { NextResponse } from "next/server";
import { cleanupExpiredReservations } from "@/app/actions/cart-reservations";
import { isProd } from "@/lib/utils";

/**
 * Cleanup endpoint for expired cart reservations
 * Can be called periodically by a cron job or manually
 *
 * For production, configure with a cron service like:
 * - Vercel Cron Jobs
 * - GitHub Actions scheduled workflows
 * - External cron services (cron-job.org, etc.)
 *
 * Recommended schedule: Every 15 minutes
 *
 * Authentication: requires `Authorization: Bearer ${CRON_SECRET}`. In
 * production the route refuses to run if CRON_SECRET is unset; outside
 * production it allows unauthenticated calls so local dev / smoke tests
 * don't need the secret configured.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (isProd && !cronSecret) {
    console.error("CRON_SECRET is not configured in production");
    return NextResponse.json(
      { success: false, error: "Server misconfigured" },
      { status: 500 }
    );
  }

  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const deletedCount = await cleanupExpiredReservations();

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} expired reservations`,
      deletedCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in cleanup-reservations cron:", error);
    return NextResponse.json(
      { success: false, error: "Failed to cleanup reservations" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
