import { createAdminClient } from "@repo/api/server";
import { isSmtpConfigured, sendEmail } from "@repo/connectors/email";
import {
  enqueueDueReminders,
  processDeliveries,
} from "@repo/shared/big-events/delivery-queue";
import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { webBaseUrl } from "@/lib/public-urls";

/**
 * Big-event email queue. Driven by the `scheduled-dispatch` Appwrite Function
 * (`BIG_EVENT_DELIVERIES_URL`), which sends `x-cron-secret`; can also be hit
 * manually with `Authorization: Bearer ${CRON_SECRET}`. The admin app kicks it
 * too after queueing a batch.
 *
 * Queues due reminders, then sends what is due within the time budget at a
 * throttled rate. When work is still due, it fires one follow-up request to
 * itself so a large batch keeps flowing between cron runs.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const BUDGET_MS = 45_000;
const DEFAULT_PER_MINUTE = 25;

function perMinute(): number {
  const value = Number(process.env.BIG_EVENTS_EMAILS_PER_MINUTE);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_PER_MINUTE;
}

function kickAgain(request: Request, secret: string): void {
  fetch(new URL(request.url), {
    headers: { "x-cron-secret": secret },
    method: "POST",
  }).catch(() => {
    console.error("[Big Event Deliveries] Follow-up run could not be started");
  });
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const connectSecret = process.env.BIG_EVENTS_CONNECT_SECRET;
  const webBase = webBaseUrl();
  if (!(secret && connectSecret && webBase)) {
    console.error("[Big Event Deliveries] Missing configuration");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json({ skipped: "smtp_not_configured" });
  }

  try {
    const { db } = await createAdminClient();
    await enqueueDueReminders(db);
    const result = await processDeliveries(
      { db, secret: connectSecret, sendEmail, webBase },
      {
        budgetMs: BUDGET_MS,
        perMinute: perMinute(),
        runId: crypto.randomUUID(),
      }
    );
    if (result.remaining > 0) {
      kickAgain(request, secret);
    }
    console.log(
      `[Big Event Deliveries] Sent ${result.sent}, failed ${result.failed}, ${result.remaining} still due`
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Big Event Deliveries] Run failed:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
