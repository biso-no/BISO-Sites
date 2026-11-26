import { createAdminClient } from "@repo/api/server";
import { runDueMessages } from "@repo/shared/big-events/messages/auto";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { webBaseUrl } from "@/lib/public-urls";

/**
 * Big event messages. Driven by the `scheduled-dispatch` Appwrite Function
 * (`BIG_EVENT_MESSAGES_URL`), which sends `x-cron-secret`; can also be hit
 * manually with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Sends scheduled messages whose time has come (and finishes sends that
 * stalled), the automatic bus messages after the bus lists are published,
 * and departure reminders 2 hours before each bus leg. Pushes go out here;
 * emails and SMS are queued for `big-event-deliveries`. After about 40
 * seconds no new send starts and no new message is written: the rest waits
 * for the next run. A send already going may take longer, up to the 300
 * seconds the route allows (ruling R38).
 */

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[Big Event Messages] CRON_SECRET is not configured");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { db, messaging, users } = await createAdminClient();
    const result = await runDueMessages(
      {
        db,
        isSmsEnabled: () => isFeatureEnabled("big_events_sms"),
        messaging,
        users,
        webBase: webBaseUrl(),
      },
      new Date()
    );
    console.log(
      `[Big Event Messages] Sent ${result.scheduled} scheduled; wrote ${result.busMessages} bus messages and ${result.reminders} reminders`
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Big Event Messages] Run failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
