import { createAdminClient } from "@repo/api/server";
import {
  clearPaymentCredentialCache,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { registerVippsWebhook } from "@repo/payment/vipps";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TRAILING_SLASH = /\/+$/;

function readBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

function isAuthorized(request: NextRequest, secret: string): boolean {
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
  ];
  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}

function databaseId(): string {
  return process.env.APPWRITE_DATABASE_ID ?? "app";
}

function webhookUrl(request: NextRequest): string {
  const base =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? new URL(request.url).origin;
  return `${base.replace(TRAILING_SLASH, "")}/api/payment/vipps/callback`;
}

/**
 * One-time (per MSN/mode) Vipps webhook registration. Registers the webhook for
 * the active credential set and stores the returned signing secret in the
 * managed `payment_settings` row so subsequent deliveries can be verified.
 * Guarded by `CRON_SECRET`; triggered from the admin payment settings UI.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await ctx.params;
  if (provider !== "vipps") {
    return NextResponse.json(
      { error: "Webhook registration is only supported for Vipps" },
      { status: 404 }
    );
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await createAdminClient();
    const creds = await resolveVippsCredentials(db);
    if (!creds) {
      return NextResponse.json(
        { error: "Vipps is not configured" },
        { status: 503 }
      );
    }

    const registeredUrl = webhookUrl(request);
    const { id, secret: webhookSecret } = await registerVippsWebhook(
      registeredUrl,
      creds
    );

    const column = creds.testMode
      ? "vipps_test_webhook_secret"
      : "vipps_live_webhook_secret";
    await db.updateRow(databaseId(), "payment_settings", "vipps", {
      [column]: webhookSecret,
    });
    clearPaymentCredentialCache();

    return NextResponse.json({
      id,
      registeredUrl,
      mode: creds.testMode ? "test" : "live",
    });
  } catch (error) {
    console.error("[payment/vipps/webhooks/register] error:", error);
    return NextResponse.json(
      { error: "Failed to register Vipps webhook" },
      { status: 500 }
    );
  }
}
