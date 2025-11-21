import { NextResponse } from "next/server";
import { cleanupExpiredReservations } from "@/app/actions/cart-reservations";

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
 */
export async function GET(request: Request) {
  try {
    // Optional: Add authorization check
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      {
        success: false,
        error: "Failed to cleanup reservations",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
