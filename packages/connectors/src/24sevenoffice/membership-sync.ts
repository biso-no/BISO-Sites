/**
 * 24SevenOffice Membership Product Sync
 *
 * Syncs membership products from 24SO to Appwrite.
 * Matches products to categories by name and calculates expiry dates.
 */

import { createAdminClient } from "@repo/api/server";
import { getAllCategories } from "./categories";
import { getMembershipProducts } from "./products";
import type {
  CategoryDefinition,
  MembershipProductSyncItem,
  MembershipProductSyncResult,
  Product,
} from "./types";

/**
 * Parse the expiry date from a membership product name.
 *
 * Examples:
 * - "BISO Membership fall 2026" -> 2026-12-31
 * - "BISO Membership spring 2026" -> 2026-06-30
 * - "BISO Membership spring 2026 - fall 2028" -> 2028-12-31
 * - "BISO Membership fall 2025 and spring 2026" -> 2026-06-30
 */
export function parseExpiryDate(name: string): string {
  // Find all season/year pairs in the name
  const pattern = /(spring|fall)\s+(\d{4})/gi;
  const matches: Array<{ season: string; year: number }> = [];

  let match = pattern.exec(name);
  while (match !== null) {
    matches.push({
      season: match[1].toLowerCase(),
      year: Number.parseInt(match[2], 10),
    });
    match = pattern.exec(name);
  }

  if (matches.length === 0) {
    // Default to end of current year if no pattern found
    const currentYear = new Date().getFullYear();
    return `${currentYear}-12-31`;
  }

  // Use the LAST season/year mentioned (rightmost in the name)
  const lastMatch = matches.at(-1);

  if (lastMatch.season === "spring") {
    return `${lastMatch.year}-06-30`;
  }
  return `${lastMatch.year}-12-31`;
}

/**
 * Parse the start date from a membership product name.
 * Uses the FIRST season/year mentioned.
 */
export function parseStartDate(name: string): string {
  const pattern = /(spring|fall)\s+(\d{4})/gi;
  const match = pattern.exec(name);

  if (!match) {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-01-01`;
  }

  const season = match[1].toLowerCase();
  const year = Number.parseInt(match[2], 10);

  if (season === "spring") {
    return `${year}-01-01`;
  }
  return `${year}-08-01`;
}

/**
 * Check if a membership is currently active based on expiry date.
 */
export function isActiveByDate(expiryDate: string): boolean {
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry >= today;
}

/**
 * Match a product to a category by name.
 */
function findCategoryForProduct(
  product: Product,
  categories: CategoryDefinition[]
): CategoryDefinition | null {
  if (!product.Name) {
    return null;
  }

  // Exact match on name
  const match = categories.find(
    (c) => c.Name?.trim().toLowerCase() === product.Name?.trim().toLowerCase()
  );

  return match || null;
}

/**
 * Sync membership products from 24SevenOffice to Appwrite.
 *
 * This function:
 * 1. Fetches membership products from 24SO
 * 2. Fetches all category definitions from 24SO
 * 3. Matches products to categories by name
 * 4. Calculates expiry dates from product names
 * 5. Upserts records to Appwrite memberships table
 */
export async function syncMembershipsFrom24SO(): Promise<MembershipProductSyncResult> {
  const result: MembershipProductSyncResult = {
    success: true,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    items: [],
  };

  try {
    console.log("[Membership Sync] Starting sync from 24SevenOffice...");

    // 1. Fetch products and categories
    const [products, categories] = await Promise.all([
      getMembershipProducts(),
      getAllCategories(),
    ]);

    console.log(
      `[Membership Sync] Found ${products.length} membership products`
    );
    console.log(`[Membership Sync] Found ${categories.length} categories`);

    // Filter categories to only BISO Membership ones for matching
    const membershipCategories = categories.filter((c) =>
      c.Name?.includes("BISO Membership")
    );
    console.log(
      `[Membership Sync] Found ${membershipCategories.length} membership categories`
    );

    // 2. Get Appwrite client
    const { db } = await createAdminClient();

    // 3. Process each product
    for (const product of products) {
      if (!(product.Id && product.Name)) {
        result.skipped += 1;
        continue;
      }

      try {
        // Find matching category
        const category = findCategoryForProduct(product, membershipCategories);

        // Parse dates
        const expiryDate = parseExpiryDate(product.Name);
        const startDate = parseStartDate(product.Name);
        const isActive = isActiveByDate(expiryDate);

        const syncItem: MembershipProductSyncItem = {
          productId: product.Id,
          productName: product.Name,
          productNo: product.No || "",
          categoryId: category?.Id || null,
          categoryName: category?.Name || null,
          expiryDate,
          startDate,
          isActive,
        };

        result.items.push(syncItem);

        // Prepare Appwrite document
        const docId = String(product.Id);
        const docData = {
          membership_id: docId,
          name: product.Name,
          category: category?.Id ? String(category.Id) : null,
          expiryDate,
          startDate,
          status: isActive,
          price: 0, // Set manually if needed
          canPurchase: false, // Controlled separately
        };

        // Upsert to Appwrite
        try {
          // Try to update existing
          await db.updateRow("app", "memberships", docId, docData);
          result.updated += 1;
          console.log(`[Membership Sync] Updated: ${product.Name}`);
        } catch (updateError: any) {
          // If not found, create new
          if (updateError?.code === 404) {
            await db.createRow("app", "memberships", docId, docData);
            result.created += 1;
            console.log(`[Membership Sync] Created: ${product.Name}`);
          } else {
            throw updateError;
          }
        }
      } catch (itemError: any) {
        const errorMsg = `Failed to sync product ${product.Id}: ${itemError.message}`;
        result.errors.push(errorMsg);
        console.error(`[Membership Sync] ${errorMsg}`);
      }
    }

    console.log(
      `[Membership Sync] Completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
    );
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Sync failed: ${error.message}`);
    console.error("[Membership Sync] Failed:", error);
  }

  return result;
}

/**
 * Preview sync without making changes.
 * Returns what would be synced without writing to database.
 */
export async function previewMembershipSync(): Promise<
  MembershipProductSyncItem[]
> {
  console.log("[Membership Sync] Generating preview...");

  const [products, categories] = await Promise.all([
    getMembershipProducts(),
    getAllCategories(),
  ]);

  const membershipCategories = categories.filter((c) =>
    c.Name?.includes("BISO Membership")
  );

  const items: MembershipProductSyncItem[] = [];

  for (const product of products) {
    if (!(product.Id && product.Name)) {
      continue;
    }

    const category = findCategoryForProduct(product, membershipCategories);
    const expiryDate = parseExpiryDate(product.Name);
    const startDate = parseStartDate(product.Name);
    const isActive = isActiveByDate(expiryDate);

    items.push({
      productId: product.Id,
      productName: product.Name,
      productNo: product.No || "",
      categoryId: category?.Id || null,
      categoryName: category?.Name || null,
      expiryDate,
      startDate,
      isActive,
    });
  }

  // Sort by expiry date (newest first)
  items.sort((a, b) => b.expiryDate.localeCompare(a.expiryDate));

  return items;
}
