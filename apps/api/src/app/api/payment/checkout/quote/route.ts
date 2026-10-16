import { createAdminClient } from "@repo/api/server";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import {
  buildTrustedCheckoutParams,
  type CheckoutLineItemInput,
  CheckoutValidationError,
  toCheckoutQuote,
} from "@/lib/checkout-pricing";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";

/**
 * Prices a cart without creating an order.
 *
 * The checkout route rebuilds every amount from stored rows and rejects a
 * request whose `total` disagrees ("Checkout total mismatch"), which leaves a
 * client with no server of its own — the native app — unable to display a
 * trustworthy total: it would have to re-implement variation pricing, the
 * member discount, and the 24SO membership lookup that decides whether the
 * discount applies at all, and then stay in step with them forever.
 *
 * So it asks instead. This runs the identical pipeline the checkout route runs
 * and returns what it produced, meaning the price a buyer sees is by
 * construction the price they are charged. Stock and purchase-limit failures
 * surface here too (409), before the buyer has committed to anything.
 *
 * Read-only: nothing is written, no payment session is created, and the
 * checkout route still recomputes everything when the buyer actually pays.
 */

const MAX_QUOTE_ITEMS = 50;

interface QuoteBody {
  items: CheckoutLineItemInput[];
}

function isValidBody(body: QuoteBody | null): body is QuoteBody {
  return Boolean(
    body &&
      Array.isArray(body.items) &&
      body.items.length > 0 &&
      body.items.length <= MAX_QUOTE_ITEMS
  );
}

function hasBearerToken(req: NextRequest): boolean {
  return req.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

async function authenticate(req: NextRequest) {
  if (!hasBearerToken(req)) {
    return null;
  }
  try {
    const client = await createAuthenticatedClient(req);
    const user = await client.account.get();
    return user?.$id ? { client, userId: user.$id } : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  try {
    // Authenticated because the price depends on who is asking: the member
    // discount is resolved from the caller's own profile and membership.
    const auth = await authenticate(req);
    if (!auth) {
      return json({ message: "Authentication required" }, 401);
    }

    const body = (await req.json().catch(() => null)) as QuoteBody | null;
    if (!isValidBody(body)) {
      return json({ message: "Invalid quote payload" }, 400);
    }

    const { db } = await createAdminClient();
    const params = await buildTrustedCheckoutParams({
      authClient: auth.client,
      db,
      items: body.items,
      // A quote never becomes an order, so it carries no payment reference.
      reference: "quote",
      userId: auth.userId,
    });

    return json(toCheckoutQuote(params));
  } catch (error) {
    if (error instanceof CheckoutValidationError) {
      return json({ message: error.message }, error.status);
    }

    console.error("[payment/checkout/quote] error:", error);
    return json({ message: "Failed to price this cart" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
