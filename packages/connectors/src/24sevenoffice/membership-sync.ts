/**
 * 24SevenOffice Membership Product Sync
 *
 * Syncs membership products from 24SO to Appwrite.
 * Matches products to categories by name and calculates expiry dates.
 */

import { createAdminClient } from "@repo/api/server";
import type { Memberships } from "@repo/api/types/appwrite";
import { getAllCategories } from "./categories";
import { mergeMembershipRow } from "./membership-sync-merge";
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
  // Safe to use non-null assertion since we checked matches.length > 0 above
  const lastMatch = matches.at(-1)!;

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
 * Parse a product's price defensively. The SOAP client types `Price` as a
 * `number`, but the actual response is XML-derived and can hand back the
 * field as a string, empty, or absent entirely — coerce and fall back to 0
 * rather than writing `NaN` into Appwrite.
 */
function parsePrice(rawPrice: unknown): number {
  const parsed = Number(rawPrice);
  return Number.isFinite(parsed) ? parsed : 0;
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
 * Build a sync item from a product
 */
function buildSyncItem(
  product: Product,
  membershipCategories: CategoryDefinition[]
): MembershipProductSyncItem {
  const category = findCategoryForProduct(product, membershipCategories);
  const expiryDate = parseExpiryDate(product.Name!);
  const startDate = parseStartDate(product.Name!);
  const isActive = isActiveByDate(expiryDate);

  return {
    productId: product.Id!,
    productName: product.Name!,
    productNo: product.No || "",
    categoryId: category?.Id || null,
    categoryName: category?.Name || null,
    expiryDate,
    startDate,
    isActive,
    price: parsePrice(product.Price),
  };
}

/**
 * True when an Appwrite SDK error's `code` indicates the row was not found.
 */
function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 404
  );
}

/**
 * Upsert a membership to Appwrite.
 *
 * Reads the existing row first (rather than blind-updating and creating on a
 * 404 catch) so `mergeMembershipRow` can decide whether an administrator-set
 * `price`/`canPurchase` should be preserved. A read failure that is not a 404
 * — e.g. a network or permissions error — is rethrown instead of being
 * treated as "row doesn't exist", so it can't silently fall through to a
 * duplicate create attempt.
 */
async function upsertMembership(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  syncItem: MembershipProductSyncItem
): Promise<"created" | "updated"> {
  const docId = String(syncItem.productId);

  let existing: Memberships | null = null;
  try {
    existing = await db.getRow<Memberships>("app", "memberships", docId);
  } catch (readError: unknown) {
    if (!isNotFoundError(readError)) {
      throw readError;
    }
  }

  const docData = mergeMembershipRow(syncItem, existing);

  if (existing) {
    await db.updateRow("app", "memberships", docId, docData);
    return "updated";
  }

  await db.createRow("app", "memberships", docId, docData);
  return "created";
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
        const syncItem = buildSyncItem(product, membershipCategories);
        result.items.push(syncItem);

        const action = await upsertMembership(db, syncItem);
        if (action === "created") {
          result.created += 1;
          console.log(`[Membership Sync] Created: ${product.Name}`);
        } else {
          result.updated += 1;
          console.log(`[Membership Sync] Updated: ${product.Name}`);
        }
      } catch (itemError: unknown) {
        const message =
          itemError instanceof Error ? itemError.message : String(itemError);
        const errorMsg = `Failed to sync product ${product.Id}: ${message}`;
        result.errors.push(errorMsg);
        console.error(`[Membership Sync] ${errorMsg}`);
      }
    }

    console.log(
      `[Membership Sync] Completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.errors.push(`Sync failed: ${message}`);
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
      price: parsePrice(product.Price),
    });
  }

  // Sort by expiry date (newest first)
  items.sort((a, b) => b.expiryDate.localeCompare(a.expiryDate));

  return items;
}
