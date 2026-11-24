import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { isSmtpConfigured, sendEmail } from "@repo/connectors/email";
import {
  enqueueDueReminders,
  processDeliveries,
} from "@repo/shared/big-events/delivery-queue";
import { BIG_EVENT_TABLES } from "@repo/shared/big-events/tables";
import { NextResponse } from "next/server";
import { hasValidCronSecret } from "@/lib/cron-auth";
import { apiBaseUrl, webBaseUrl } from "@/lib/public-urls";

/**
 * Big-event email queue. Driven by the `scheduled-dispatch` Appwrite Function
 * (`BIG_EVENT_DELIVERIES_URL`), which sends `x-cron-secret`; can also be hit
 * manually with `Authorization: Bearer ${CRON_SECRET}`. The admin app kicks it
 * too after queueing a batch.
 *
 * Queues due reminders, then sends what is due within the time budget at a
 * throttled rate. When work is still due, it fires one follow-up request to
 * itself so a large batch keeps flowing between cron runs. Only one sending
 * chain runs at a time: a run yields while another chain's claim is under 90
 * seconds old, and follow-ups carry the chain id and a depth (capped at 50).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const BUDGET_MS = 45_000;
const DEFAULT_PER_MINUTE = 25;

function perMinute(): number {
  const value = Number(process.env.BIG_EVENTS_EMAILS_PER_MINUTE);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_PER_MINUTE;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAIN_HEADER = "x-delivery-chain";
const DEPTH_HEADER = "x-kick-depth";
const MAX_KICK_DEPTH = 50;
/** A claim this recent means a chain is still sending. */
const ACTIVE_CLAIM_MS = 90_000;

function readChainId(request: Request): string {
  const value = request.headers.get(CHAIN_HEADER);
  return value && UUID_RE.test(value) ? value : crypto.randomUUID();
}

function readDepth(request: Request): number {
  const depth = Number(request.headers.get(DEPTH_HEADER));
  return Number.isInteger(depth) && depth > 0 ? depth : 0;
}

async function otherChainIsActive(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  chainId: string
): Promise<boolean> {
  const since = new Date(Date.now() - ACTIVE_CLAIM_MS).toISOString();
  const { rows } = await db.listRows("app", BIG_EVENT_TABLES.deliveries, [
    Query.greaterThan("claimed_at", since),
    Query.notEqual("claimed_by", chainId),
    Query.limit(1),
    Query.select(["$id"]),
  ]);
  return rows.length > 0;
}

/**
 * Where the follow-up run goes: this api's public address when it is set,
 * since behind a proxy the request may have arrived on an internal one.
 */
function followUpUrl(request: Request): string {
  const base = apiBaseUrl();
  return base ? `${base}/api/cron/big-event-deliveries` : request.url;
}

function kickAgain(request: Request, secret: string, chainId: string): void {
  fetch(followUpUrl(request), {
    headers: {
      [CHAIN_HEADER]: chainId,
      [DEPTH_HEADER]: String(readDepth(request) + 1),
      "x-cron-secret": secret,
    },
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
    const chainId = readChainId(request);
    if (await otherChainIsActive(db, chainId)) {
      return NextResponse.json({ skipped: "busy" });
    }
    await enqueueDueReminders(db);
    const result = await processDeliveries(
      { db, secret: connectSecret, sendEmail, webBase },
      {
        budgetMs: BUDGET_MS,
        perMinute: perMinute(),
        runId: chainId,
      }
    );
    if (result.remaining > 0 && readDepth(request) < MAX_KICK_DEPTH) {
      kickAgain(request, secret, chainId);
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
