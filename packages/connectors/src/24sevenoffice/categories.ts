/**
 * 24SevenOffice Customer Categories Service
 *
 * Handles assignment of membership categories to customers.
 * Categories are used to classify customers by membership tier.
 */

import { createAuthenticatedClient } from "./client";
import { getValidSession } from "./auth";
import type {
  GetCustomerCategoriesResult,
  GetCategoriesResult,
  CategoryDefinition,
  KeyValuePair,
  SaveCustomerCategoriesResult
} from "./types";

/**
 * Assign categories to a customer in 24SevenOffice
 *
 * @param companyId - The 24SO company/customer ID
 * @param categories - Array of category names to assign
 */
export async function saveCustomerCategories(
  companyId: number,
  categories: string[]
): Promise<void> {
  if (categories.length === 0) {
    console.log("[24SO Categories] No categories to assign");
    return;
  }

  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  // Build category key-value pairs
  // Key = CompanyId, Value = Category name
  const categoryPairs: KeyValuePair[] = categories.map((category) => ({
    Key: companyId.toString(),
    Value: category,
  }));

  try {
    const [result]: [SaveCustomerCategoriesResult] =
      await client.SaveCustomerCategoriesAsync({
        customerCategories: {
          KeyValuePair: categoryPairs,
        },
      });

    // Check for API exceptions in response
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
      `[24SO Categories] Assigned categories to customer ${companyId}: ${categories.join(", ")}`
    );
  } catch (error) {
    console.error("[24SO Categories] Failed to save categories:", error);
    throw error;
  }
}

/**
 * Assign a single category to a customer
 */
export async function assignMembershipCategory(
  companyId: number,
  category: string
): Promise<void> {
  return saveCustomerCategories(companyId, [category]);
}

/**
 * Get all category IDs assigned to a customer
 * @returns Array of category IDs (integers)
 */
export async function getCustomerCategories(companyId: number): Promise<number[]> {
  const session = await getValidSession();
  const client = await createAuthenticatedClient("company", session);

  try {
    const [result]: [GetCustomerCategoriesResult] =
      await client.GetCustomerCategoriesAsync({
        customerId: companyId,  // API expects 'customerId' not 'companyId'
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
    console.log(`[24SO Categories] Found ${categoryList.length} category definitions`);

    return categoryList;
  } catch (error) {
    console.error("[24SO Categories] Failed to get all categories:", error);
    throw error;
  }
}