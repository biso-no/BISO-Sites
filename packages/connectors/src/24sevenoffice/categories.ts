/**
 * 24SevenOffice Customer Categories Service
 *
 * Handles assignment of membership categories to customers.
 * Categories are used to classify customers by membership tier.
 */

import { getValidSession } from "./auth";
import { createAuthenticatedClient } from "./client";
import type {
  CategoryDefinition,
  GetCategoriesResult,
  GetCustomerCategoriesResult,
  KeyValuePair,
  SaveCustomerCategoriesResult,
} from "./types";

/**
 * Build the KeyValuePairs 24SevenOffice's `SaveCustomerCategories` expects.
 *
 * The API's Key is the CATEGORY id and Value is the COMPANY id — the
 * opposite of what the parameter names suggest. `getCustomerCategoryTree`
 * reads them back with the same orientation. Re-exported by
 * `@repo/shared/utils/finago-category-pairs` for regression testing, since
 * this package has no vitest runner.
 */
export function buildCustomerCategoryPairs(
  customerId: number,
  categoryIds: number[]
): Array<{ Key: string; Value: string }> {
  return categoryIds
    .filter((id) => Number.isFinite(id))
    .map((categoryId) => ({
      Key: String(categoryId),
      Value: String(customerId),
    }));
}

/**
 * Assign categories to a customer in 24SevenOffice
 *
 * @param companyId - The 24SO company/customer ID
 * @param categoryIds - Array of category IDs to assign
 */
export async function saveCustomerCategories(
  companyId: number,
  categoryIds: number[]
): Promise<void> {
  const categoryPairs = buildCustomerCategoryPairs(companyId, categoryIds);
  if (categoryPairs.length === 0) {
    console.log("[24SO Categories] No categories to assign");
    return;
  }

  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  try {
    const [result]: [SaveCustomerCategoriesResult] =
      await client.SaveCustomerCategoriesAsync({
        customerCategories: {
          KeyValuePair: categoryPairs,
        },
      });

    const exceptions = result.SaveCustomerCategoriesResult?.APIException;
    if (exceptions) {
      const errorList = Array.isArray(exceptions) ? exceptions : [exceptions];
      const errors = errorList.filter((e) => e.Message);

      if (errors.length > 0) {
        console.error(
          "[24SO Categories] Errors assigning categories:",
          errors.map((e) => e.Message).join(", ")
        );
        throw new Error(
          `Failed to assign categories: ${errors[0]?.Message || "Unknown error"}`
        );
      }
    }

    console.log(
      `[24SO Categories] Assigned categories to customer ${companyId}: ${categoryIds.join(", ")}`
    );
  } catch (error) {
    console.error("[24SO Categories] Failed to save categories:", error);
    throw error;
  }
}

/**
 * Assign a single category to a customer.
 */
export function assignMembershipCategory(
  companyId: number,
  categoryId: number
): Promise<void> {
  return saveCustomerCategories(companyId, [categoryId]);
}

/**
 * Get all category IDs assigned to a customer
 * @returns Array of category IDs (integers)
 */
export async function getCustomerCategories(
  companyId: number
): Promise<number[]> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  try {
    const [result]: [GetCustomerCategoriesResult] =
      await client.GetCustomerCategoriesAsync({
        customerId: companyId, // API expects 'customerId' not 'companyId'
      });

    // Check for API exceptions in response
    const exceptions = result.GetCustomerCategoriesResult?.APIException;
    if (exceptions) {
      const errorList = Array.isArray(exceptions) ? exceptions : [exceptions];
      const errors = errorList.filter((e) => e.Message);

      if (errors.length > 0) {
        console.error(
          "[24SO Categories] Errors getting categories:",
          errors.map((e) => e.Message).join(", ")
        );
        throw new Error(
          `Failed to get categories: ${errors[0]?.Message || "Unknown error"}`
        );
      }
    }

    // Extract category IDs from the response
    // API returns { int: number | number[] } for category IDs
    const rawIds = result.GetCustomerCategoriesResult?.int;
    let categoryIds: number[] = [];

    if (rawIds !== undefined) {
      categoryIds = Array.isArray(rawIds) ? rawIds : [rawIds];
    }

    console.log(
      `[24SO Categories] Got category IDs for customer ${companyId}: ${categoryIds.length > 0 ? categoryIds.join(", ") : "(none)"}`
    );
    return categoryIds;
  } catch (error) {
    console.error("[24SO Categories] Failed to get categories:", error);
    throw error;
  }
}

/**
 * Get all category definitions from 24SevenOffice
 * This returns ALL categories in the system, not just those assigned to a customer.
 * Used for syncing membership products.
 *
 * @returns Array of category definitions with Id and Name
 */
export async function getAllCategories(): Promise<CategoryDefinition[]> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  try {
    const [result]: [GetCategoriesResult] = await client.GetCategoriesAsync({});

    const categories = result.GetCategoriesResult?.Category;

    if (!categories) {
      console.log("[24SO Categories] No categories found");
      return [];
    }

    // Handle single or multiple results
    const categoryList = Array.isArray(categories) ? categories : [categories];
    console.log(
      `[24SO Categories] Found ${categoryList.length} category definitions`
    );

    return categoryList;
  } catch (error) {
    console.error("[24SO Categories] Failed to get all categories:", error);
    throw error;
  }
}

/**
 * Get all membership categories from 24SevenOffice
 * This returns ALL categories relevant to membership products in the system, not just those assigned to a customer.
 * Used for syncing membership products.
 */

export async function getMembershipCategories(): Promise<CategoryDefinition[]> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  try {
    const [result]: [GetCategoriesResult] = await client.GetCategoriesAsync({});

    const categories = result.GetCategoriesResult?.Category;

    if (!categories) {
      console.log("[24SO Categories] No categories found");
      return [];
    }

    // Handle single or multiple results
    const categoryList = Array.isArray(categories) ? categories : [categories];
    console.log(
      `[24SO Categories] Found ${categoryList.length} category definitions`
    );

    // Filter out categories that are not relevant to membership products
    const membershipCategories = categoryList.filter((c) =>
      c.Name?.includes("BISO Membership")
    );

    console.log(
      `[24SO Categories] Found ${membershipCategories.length} membership categories`
    );
    return membershipCategories;
  } catch (error) {
    console.error("[24SO Categories] Failed to get all categories:", error);
    throw error;
  }
}

// ============= Customer Category Tree =============

export interface CustomerCategoryMapping {
  categoryId: number;
  companyId: number;
}

interface GetCustomerCategoryTreeResult {
  GetCustomerCategoryTreeResult?: {
    KeyValuePair?: KeyValuePair | KeyValuePair[];
  };
}

/**
 * Get all customer-category mappings from 24SevenOffice.
 * This is efficient for getting which customers belong to which categories
 * without making individual API calls per customer.
 *
 * API returns: Key = CategoryId, Value = CompanyId
 *
 * @returns Array of { companyId, categoryId } pairs
 */
export async function getCustomerCategoryTree(): Promise<
  CustomerCategoryMapping[]
> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  try {
    const [result]: [GetCustomerCategoryTreeResult] =
      await client.GetCustomerCategoryTreeAsync({});

    const pairs = result.GetCustomerCategoryTreeResult?.KeyValuePair;

    if (!pairs) {
      console.log("[24SO Categories] No customer-category mappings found");
      return [];
    }

    // Handle single or multiple results
    const pairList = Array.isArray(pairs) ? pairs : [pairs];

    // Convert to our format: Key = CategoryId, Value = CompanyId
    const mappings: CustomerCategoryMapping[] = pairList
      .map((pair) => ({
        categoryId: Number.parseInt(pair.Key, 10),
        companyId: Number.parseInt(pair.Value, 10),
      }))
      .filter(
        (m) => !(Number.isNaN(m.categoryId) || Number.isNaN(m.companyId))
      );

    console.log(
      `[24SO Categories] Found ${mappings.length} customer-category mappings`
    );
    return mappings;
  } catch (error) {
    console.error(
      "[24SO Categories] Failed to get customer category tree:",
      error
    );
    throw error;
  }
}
