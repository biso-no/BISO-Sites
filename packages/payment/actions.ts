"use server";

import { createSessionClient } from "@repo/api/server";
import type { Orders } from "@repo/api/types/appwrite";
import { redirect } from "next/navigation";
import {
  type CheckoutSessionParams,
  createCheckoutSession,
  getOrderStatus,
  verifyOrderStatus,
} from "./vipps";

/**
 * Server action to initiate Vipps checkout
 * This should be called from the cart page when user clicks "Go to Checkout"
 *
 * @param params - Checkout session parameters including items, total, customer info
 * @returns Redirects user to Vipps checkout page
 * @throws Error if checkout creation fails
 */
export async function initiateVippsCheckout(
  params: CheckoutSessionParams
): Promise<never> {
  try {
    // Get database client from session
    const { db } = await createSessionClient();

    // Create checkout session (this creates order in DB and gets Vipps URL)
    const { checkoutUrl, orderId, sessionId } = await createCheckoutSession(
      params,
      db
    );

    console.log(`[Checkout] Created session ${sessionId} for order ${orderId}`);

    // Redirect user to Vipps checkout page
    redirect(checkoutUrl);
  } catch (error) {
    console.error("[Checkout] Failed to create checkout session:", error);
    // Redirect to cart with error message
    redirect("/shop/cart?error=checkout_failed");
  }
}

/**
 * Server action to get order status
 * Used in Server Components to fetch order data
 *
 * @param orderId - Order ID to retrieve
 * @returns Order object or null if not found
 */
export async function getOrder(orderId: string): Promise<Orders | null> {
  try {
    const { db } = await createSessionClient();
    return await getOrderStatus(orderId, db);
  } catch (error) {
    console.error("[Order] Failed to get order status:", error);
    return null;
  }
}

/**
 * Server action to verify order status with Vipps
 * Used to ensure order status is up-to-date after user returns
 *
 * @param orderId - Order ID to verify
 * @returns Updated order object or null if not found
 */
export async function verifyOrder(orderId: string): Promise<Orders | null> {
  try {
    const { db } = await createSessionClient();
    return await verifyOrderStatus(orderId, db);
  } catch (error) {
    console.error("[Order] Failed to verify order status:", error);
    return null;
  }
}
