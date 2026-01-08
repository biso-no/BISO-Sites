/**
 * 24SevenOffice Membership Sync Service
 *
 * Orchestrates the synchronization of membership purchases to 24SevenOffice.
 * When a user purchases a membership:
 * 1. Find or create customer in 24SO CRM
 * 2. Assign the membership category to the customer
 */

import type { Orders, Users, Memberships } from "@repo/api/types/appwrite";
import { findOrCreateCompany } from "./company";
import { assignMembershipCategory } from "./categories";
import type { CustomerData, MembershipSyncResult } from "./types";

/**
 * Sync a membership purchase to 24SevenOffice
 *
 * Call this after a successful membership payment to:
 * 1. Ensure customer exists in 24SO CRM
 * 2. Assign the membership category to the customer
 *
 * @param order - The completed order
 * @param user - The user who made the purchase (can be null for guest checkout)
 * @param membership - The membership tier purchased
 */
export async function syncMembershipTo24SO(
  order: Orders,
  user: Users | null,
  membership: Memberships
): Promise<MembershipSyncResult> {
  try {
    console.log(
      `[24SO Sync] Starting membership sync for order ${order.$id}`
    );

    // 1. Parse customer information
    const customerData = extractCustomerData(order, user);

    // 2. Find or create customer in 24SO
    const company = await findOrCreateCompany(customerData);

    if (!company.Id) {
      throw new Error("Company created but no ID returned");
    }

    // 3. Assign membership category if available
    let categoryAssigned: string | undefined;
    if (membership.category) {
      await assignMembershipCategory(company.Id, membership.category);
      categoryAssigned = membership.category;
    }

    console.log(
      `[24SO Sync] Successfully synced membership for order ${order.$id}` +
        ` (Company ID: ${company.Id}, Category: ${categoryAssigned || "none"})`
    );

    return {
      success: true,
      companyId: company.Id,
      companyName: company.Name,
      categoryAssigned,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    console.error(
      `[24SO Sync] Failed to sync membership for order ${order.$id}:`,
      error
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Extract customer data from order and user
 */
function extractCustomerData(
  order: Orders,
  user: Users | null
): CustomerData {
  // Try to get name from user first, then from order
  const fullName =
    user?.name || order.buyer_name || "Unknown Customer";

  // Split name into first and last
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Unknown";
  const lastName = nameParts.slice(1).join(" ") || "Customer";

  // Get contact info
  const email = user?.email || order.buyer_email || undefined;
  const phone = user?.phone || order.buyer_phone || undefined;

  // Get student ID if available - studentId is a relation to StudentIds
  const studentId = user?.studentId?.student_id || user?.student_id || undefined;

  // Get user ID
  const userId = user?.$id || order.userId || "guest";

  return {
    firstName,
    lastName,
    email,
    phone,
    studentId,
    userId,
  };
}

/**
 * Check if an order contains a membership product
 *
 * @param itemsJson - The items_json string from the order
 * @returns true if order contains a membership product
 */
export function hasMembershipProduct(itemsJson: string | null): boolean {
  if (!itemsJson) return false;

  try {
    const items = JSON.parse(itemsJson);
    if (!Array.isArray(items)) return false;

    return items.some(
      (item) =>
        item.product_type === "membership" ||
        item.category?.toLowerCase() === "membership"
    );
  } catch {
    return false;
  }
}
