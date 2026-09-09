import { createAdminClient } from "@repo/api/server";
import {
  resolveStripeCredentials,
  resolveVippsCredentials,
} from "@repo/payment/credentials";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

/**
 * Which payment providers a client may offer right now.
 *
 * Two independent switches decide this, and both live server-side:
 *
 * 1. The `payments_vipps` / `payments_stripe` feature flags — the kill switch
 *    administrators toggle in the admin app when a provider is down or not
 *    being offered.
 * 2. Whether the provider's credentials are actually configured for the active
 *    (test or live) mode. Those secrets live in `payment_settings`, which no
 *    end user can read, so a client cannot work this out for itself.
 *
 * The website reads the flags directly in a server component; the native app
 * cannot, which is what this endpoint is for. Offering a provider the server
 * would refuse means sending the buyer to a dead end, so both switches are
 * reported together and a provider is only `available` when both say yes.
 *
 * Public on purpose: the response says nothing beyond which buttons to draw,
 * and the checkout route re-checks both switches before taking any money.
 */

export const dynamic = "force-dynamic";

// Matches the credential/flag reader TTLs. Long enough that a shop page load
// costs nothing, short enough that flipping a provider off reaches buyers in
// seconds rather than minutes.
const CACHE_MAX_AGE_SECONDS = 15;

type Provider = "vipps" | "stripe";

interface ProviderAvailability {
  /** True only when the provider is both enabled and configured. */
  available: boolean;
  /** Whether the active-mode credentials are present. */
  configured: boolean;
  /** The kill switch in the admin app. */
  enabled: boolean;
  id: Provider;
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  try {
    const flags = await getFeatureFlagStates();
    const { db } = await createAdminClient();

    const [vippsCreds, stripeCreds] = await Promise.all([
      resolveVippsCredentials(db).catch(() => null),
      resolveStripeCredentials(db).catch(() => null),
    ]);

    const providers: ProviderAvailability[] = [
      {
        id: "vipps",
        enabled: flags.payments_vipps,
        configured: Boolean(vippsCreds),
        available: flags.payments_vipps && Boolean(vippsCreds),
      },
      {
        id: "stripe",
        enabled: flags.payments_stripe,
        configured: Boolean(stripeCreds),
        available: flags.payments_stripe && Boolean(stripeCreds),
      },
    ];

    const response = json({ providers });
    response.headers.set(
      "Cache-Control",
      `public, max-age=0, s-maxage=${CACHE_MAX_AGE_SECONDS}`
    );
    return response;
  } catch (error) {
    console.error("[payment/providers] error:", error);
    // Fail closed: a client that cannot learn what is available must not guess.
    return json({ message: "Failed to resolve payment providers" }, 503);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
