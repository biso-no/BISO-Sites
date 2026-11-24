"use server";

import { createAdminClient } from "@repo/api/server";
import {
  type LinkRefusal,
  linkParticipant,
} from "@repo/shared/big-events/linking";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import {
  type ConnectView,
  connectPath,
  queueConnectLinks,
  readConnectContext,
} from "@/lib/big-events/connect";
import { clientKeyFromHeaders, createRateLimiter } from "@/lib/rate-limit";

export type ConnectTicketResult =
  | { ok: true }
  | { ok: false; reason: LinkRefusal | "invalid" };

const HOUR_MS = 3_600_000;
const MAX_EMAIL_LENGTH = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRAILING_SLASHES = /\/+$/;

// "Didn't get the email?" is public, and every accepted request can send a
// real email to whatever address was typed. One limiter caps a client, the
// other caps how often one inbox can be sent links, whoever asks.
const clientLimiter = createRateLimiter({ limit: 5, windowMs: HOUR_MS });
const addressLimiter = createRateLimiter({ limit: 3, windowMs: HOUR_MS });

/** The caller's rate-limit key, or null when it can't be told (see rate-limit.ts). */
async function resolveClientKey(): Promise<string | null> {
  try {
    return clientKeyFromHeaders(await headers());
  } catch {
    return null;
  }
}

/** Why a view that isn't `confirm` can't be connected. */
function refusalFor(view: ConnectView): LinkRefusal | "invalid" {
  switch (view.state) {
    case "signed_out":
    case "needs_bi":
      return "not_bi_linked";
    case "linked_to_other":
      return "linked_to_other";
    case "account_has_ticket":
      return "account_has_ticket";
    default:
      return "invalid";
  }
}

/**
 * The "Connect my ticket" button: links the link's participant to the
 * signed-in BI account. Re-reads everything, so a page that has gone stale
 * can't link what the page would no longer offer.
 */
export async function connectTicket(
  token: string
): Promise<ConnectTicketResult> {
  const { target, view } = await readConnectContext(token);
  if (view.state === "invalid") {
    return { ok: false, reason: "invalid" };
  }
  let result: ConnectTicketResult;
  if (view.state === "connected") {
    result = { ok: true };
  } else if (target) {
    result = await linkParticipant(target.db, {
      method: "connect",
      participant: target.participant,
      userId: target.userId,
    });
  } else {
    result = { ok: false, reason: refusalFor(view) };
  }
  // The page re-reads the link and shows where it stands now.
  revalidatePath(connectPath(token));
  return result;
}

/** Starts the api's sending run now rather than at the next cron tick. */
function kickDeliveries(): void {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  const secret = process.env.CRON_SECRET;
  if (!(base && secret)) {
    return;
  }
  fetch(`${base.replace(TRAILING_SLASHES, "")}/api/cron/big-event-deliveries`, {
    cache: "no-store",
    headers: { "x-cron-secret": secret },
    method: "POST",
  }).catch(() => {
    // The next cron run sends it.
  });
}

async function sendConnectLinks(address: string): Promise<void> {
  try {
    const { db } = await createAdminClient();
    if ((await queueConnectLinks(db, address)) > 0) {
      kickDeliveries();
    }
  } catch (error) {
    console.error("[Connect help] Could not queue connect links", error);
  }
}

/**
 * "Didn't get the email?": sends new connect links to the address typed,
 * when it is the ticket email of anyone not yet connected. The answer is
 * always the same, and the lookup runs after it has been sent, so neither the
 * answer nor how long it took says whether the address is on any list.
 */
export async function requestConnectLink(email: string): Promise<{ ok: true }> {
  const address = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (address.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(address)) {
    return { ok: true };
  }
  const clientKey = await resolveClientKey();
  if (clientKey && !clientLimiter.reserve(clientKey).allowed) {
    return { ok: true };
  }
  if (!addressLimiter.reserve(address).allowed) {
    return { ok: true };
  }
  after(() => sendConnectLinks(address));
  return { ok: true };
}
