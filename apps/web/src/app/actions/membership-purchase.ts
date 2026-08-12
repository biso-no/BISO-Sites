"use server";

import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { sanitizeStudentNumber } from "@repo/shared/utils/bi-student";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { CAMPUS_INVOICE_NAMES } from "@repo/shared/utils/finago-membership-invoice";
import { getMembershipPlanById } from "@/lib/membership-catalog";

// The bi_* columns are pending an `appwrite push tables`; extend locally until
// packages/api/types/appwrite.ts is regenerated. Mirrors the pattern in
// src/lib/actions/bi-identity.ts.
type BiUser = Users & {
  bi_campus_id?: string | null;
  bi_employee_id?: string | null;
};

export interface StartMembershipCheckoutInput {
  campusId: string;
  planId: string;
  provider: "vipps" | "stripe";
}

export type StartMembershipCheckoutResult =
  | { success: true; paymentUrl: string; orderId: string }
  | { success: false; error: string };

const CHECKOUT_TIMEOUT_MS = 10_000;

/**
 * Starts a membership purchase.
 *
 * Fails closed on every precondition — authentication, BI link, Azure employee
 * id, campus validity, plan availability — so no student can be charged for a
 * membership this system could not then register in Finago. The price is not
 * sent: the API re-reads it from the `memberships` table.
 */
export async function startMembershipCheckout(
  input: StartMembershipCheckoutInput
): Promise<StartMembershipCheckoutResult> {
  try {
    const flags = await getFeatureFlagStates();
    const providerEnabled =
      input.provider === "vipps" ? flags.payments_vipps : flags.payments_stripe;
    if (!providerEnabled) {
      return {
        success: false,
        error: `${input.provider === "vipps" ? "Vipps" : "Card"} payment is currently unavailable.`,
      };
    }

    if (!CAMPUS_INVOICE_NAMES[input.campusId]) {
      return { success: false, error: "Select a valid campus." };
    }

    const { account, db } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      return { success: false, error: "You must be signed in." };
    }

    const profile = (await db
      .getRow<BiUser>("app", "user", user.$id)
      .catch(() => null)) as BiUser | null;

    if (sanitizeStudentNumber(profile?.student_id) === null) {
      return {
        success: false,
        error: "Link your BI student account before purchasing.",
      };
    }
    if (!profile?.bi_employee_id) {
      return {
        success: false,
        error:
          "We could not verify your BI student record. Please contact us so we can help.",
      };
    }

    const plan = await getMembershipPlanById(input.planId);
    if (!plan) {
      return {
        success: false,
        error: "That membership is no longer available.",
      };
    }

    // Remember the campus so it prefills next time and so the profile reflects
    // what the student told us at purchase.
    const { db: adminDb } = await createAdminClient();
    await adminDb
      .updateRow<BiUser>("app", "user", user.$id, {
        bi_campus_id: input.campusId,
      })
      .catch(() => {
        // Non-critical: the campus is carried on the order regardless.
      });

    const jwt = await account.createJWT().catch(() => null);
    if (!jwt?.jwt) {
      return { success: false, error: "A valid session is required." };
    }

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!apiBaseUrl) {
      return { success: false, error: "Checkout is misconfigured." };
    }

    const response = await fetch(
      `${apiBaseUrl}/api/payment/${input.provider}/membership-checkout`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt.jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: input.planId,
          campusId: input.campusId,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(CHECKOUT_TIMEOUT_MS),
      }
    );

    const result = await response.json().catch(() => null);
    if (!(response.ok && result?.checkoutUrl && result?.orderId)) {
      return {
        success: false,
        error: result?.message ?? "Failed to start checkout. Please try again.",
      };
    }

    return {
      success: true,
      paymentUrl: result.checkoutUrl as string,
      orderId: result.orderId as string,
    };
  } catch (error) {
    console.error("[Membership Checkout] Failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
