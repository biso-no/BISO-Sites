/**
 * 24SevenOffice Customer Categories Service
 *
 * Handles assignment of membership categories to customers.
 * Categories are used to classify customers by membership tier.
 */

import { createAuthenticatedClient } from "./client";
import { getValidSession } from "./auth";
import type { KeyValuePair, SaveCustomerCategoriesResult } from "./types";

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
