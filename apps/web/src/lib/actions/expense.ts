"use server";

import { ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Expenses, ExpensesStatus } from "@repo/api/types/appwrite";

const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT || process.env.APPWRITE_PROJECT_ID;

/**
 * Get all expenses for the current user with optional filters
 */
export async function getExpenses(filters?: {
  status?: ExpensesStatus;
  campus?: string;
}) {
  try {
    const { db, account } = await createSessionClient();
    const user = await account.get();

    const queries = [
      Query.equal("userId", user.$id),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ];

    if (filters?.status) {
      queries.push(Query.equal("status", filters.status));
    }

    if (filters?.campus) {
      queries.push(Query.equal("campus", filters.campus));
    }

    const response = await db.listRows<Expenses>("app", "expense", queries);

    return {
      success: true,
      expenses: response.rows,
      total: response.total,
    };
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return {
      success: false,
      expenses: [],
      total: 0,
      error:
        error instanceof Error ? error.message : "Failed to fetch expenses",
    };
  }
}

/**
 * Get a single expense by ID with full details including attachments
 */
export async function getExpenseById(expenseId: string) {
  try {
    const { db, account } = await createSessionClient();
    const user = await account.get();

    const expense = await db.getRow<Expenses>("app", "expense", expenseId, [
      Query.select([
        "$id",
        "$createdAt",
        "$updatedAt",
        "campus",
        "department",
        "bank_account",
        "description",
        "total",
        "prepayment_amount",
        "status",
        "invoice_id",
        "userId",
        "eventName",
        "expenseAttachments.*",
        "user.name",
        "user.email",
        "departmentRel.Name",
      ]),
    ]);

    // Verify the expense belongs to the current user
    if (expense.userId !== user.$id) {
      return {
        success: false,
        expense: null,
        error: "Unauthorized access",
      };
    }

    return {
      success: true,
      expense,
    };
  } catch (error) {
    console.error("Error fetching expense:", error);
    return {
      success: false,
      expense: null,
      error: error instanceof Error ? error.message : "Failed to fetch expense",
    };
  }
}

/**
 * Upload an expense attachment to Appwrite storage
 */
export async function uploadExpenseAttachment(formData: FormData) {
  try {
    const { storage } = await createSessionClient();
    const file = formData.get("file") as File;

    if (!file) {
      return {
        success: false,
        error: "No file provided",
      };
    }

    const result = await storage.createFile(
      "expenses", // Bucket ID
      ID.unique(),
      file
    );
    const viewUrl =
      APPWRITE_ENDPOINT && APPWRITE_PROJECT
        ? `${APPWRITE_ENDPOINT}/storage/buckets/expenses/files/${result.$id}/view?project=${APPWRITE_PROJECT}`
        : "";

    return {
      success: true,
      file: {
        $id: result.$id,
        bucketId: result.bucketId,
        $createdAt: result.$createdAt,
        $updatedAt: result.$updatedAt,
        $permissions: result.$permissions,
        name: result.name,
        signature: result.signature,
        mimeType: result.mimeType,
        sizeOriginal: result.sizeOriginal,
        chunksTotal: result.chunksTotal,
        chunksUploaded: result.chunksUploaded,
        viewUrl,
      },
    };
  } catch (error) {
    console.error("Error uploading attachment:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to upload attachment",
    };
  }
}
