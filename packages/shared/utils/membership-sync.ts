import type { Memberships, Orders, Users } from "@repo/api/types/appwrite";
import {
  hasMembershipProduct,
  syncMembershipTo24SO,
} from "@repo/connectors/24sevenoffice";
import { Query } from "node-appwrite";
import { type ParsedOrderItem, parseOrderItems } from "./order-parsing";

interface DbClient {
  getRow: (dbId: string, collId: string, docId: string) => Promise<unknown>;
  listRows: (
    dbId: string,
    collId: string,
    queries?: string[]
  ) => Promise<{ rows: unknown[] }>;
}

/**
 * Triggers 24SevenOffice sync for membership orders
 * This runs asynchronously to not block the Vipps callback
 */
export async function triggerMembershipSync(
  order: Orders,
  db: DbClient
): Promise<void> {
  // Check if order contains a membership product
  if (!hasMembershipProduct(order.items_json)) {
    console.log(
      `[24SO Sync] Order ${order.$id} has no membership products, skipping sync`
    );
    return;
  }

  console.log(
    `[24SO Sync] Order ${order.$id} contains membership, triggering sync`
  );

  try {
    const dbId = process.env.APPWRITE_DATABASE_ID!;

    // Get user if order has userId
    let user: Users | null = null;
    if (order.userId) {
      try {
        user = (await db.getRow(
          dbId,
          "users",
          order.userId
        )) as unknown as Users;
      } catch (err) {
        console.warn(`[24SO Sync] Could not fetch user ${order.userId}:`, err);
      }
    }

    // Parse order items to find membership product
    const items = parseOrderItems(order.items_json);
    const membershipItem = items.find(
      (item) =>
        item.product_type === "membership" ||
        item.category?.toLowerCase() === "membership"
    );

    if (!membershipItem) {
      console.warn("[24SO Sync] No membership item found in parsed items");
      return;
    }

    // Get membership details
    const membership = await getOrDefaultMembership(membershipItem, dbId, db);

    // Sync to 24SevenOffice
    const result = await syncMembershipTo24SO(order, user, membership);

    if (result.success) {
      console.log(
        `[24SO Sync] Successfully synced order ${order.$id} - Company ID: ${result.companyId}`
      );
    } else {
      console.error(
        `[24SO Sync] Failed to sync order ${order.$id}: ${result.error}`
      );
    }
  } catch (error) {
    console.error("[24SO Sync] Error during membership sync:", error);
  }
}

async function getOrDefaultMembership(
  membershipItem: ParsedOrderItem,
  dbId: string,
  db: DbClient
): Promise<Memberships> {
  let membership: Memberships | null = null;
  if (membershipItem.product_id) {
    try {
      const memberships = await db.listRows(dbId, "memberships", [
        Query.equal("membership_id", membershipItem.product_id),
        Query.limit(1),
      ]);
      if (memberships.rows.length > 0) {
        membership = memberships.rows[0] as unknown as Memberships;
      }
    } catch (err) {
      console.warn("[24SO Sync] Could not fetch membership:", err);
    }
  }

  if (membership) {
    return membership;
  }

  return {
    $id: membershipItem.product_id || "unknown",
    $collectionId: "memberships",
    $databaseId: dbId,
    $createdAt: new Date().toISOString(),
    $updatedAt: new Date().toISOString(),
    $permissions: [],
    membership_id: membershipItem.product_id || "unknown",
    name: membershipItem.title || membershipItem.name || "Membership",
    price: membershipItem.unit_price || membershipItem.price || 0,
    category: membershipItem.category || null,
    status: true,
    startDate: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    canPurchase: true,
    studentId: [],
    payments: [],
    $sequence: 0,
    $tableId: "memberships",
  } as unknown as Memberships;
}
