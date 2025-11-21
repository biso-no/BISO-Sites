import { NextResponse } from "next/server";

/**
 * Legacy Vipps Webhook Endpoint
 *
 * @deprecated Use /api/payment/vipps/callback instead
 *
 * This endpoint is kept for backward compatibility.
 * New implementations should use the /api/payment/vipps/callback endpoint
 * which includes proper authentication and error handling.
 */
export async function POST() {
  console.warn(
    "[Deprecated] /api/checkout/webhook is deprecated. Use /api/payment/vipps/callback instead."
  );

  return NextResponse.json(
    {
      ok: false,
      message:
        "This endpoint is deprecated. Please use /api/payment/vipps/callback",
    },
    { status: 410 } // Gone
  );
}
