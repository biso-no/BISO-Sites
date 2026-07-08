"use server";

import { ID, Permission, Query, Role } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { Expenses, ExpensesStatus } from "@repo/api/types/appwrite";
import {
  ALLOWED_RECEIPT_LABEL,
  isAllowedReceiptMimeType,
} from "@repo/shared/utils/expense-attachments";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";

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
        "submitter_is_financial_manager",
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
    if (!(await isFeatureEnabled("expenses_module"))) {
      return {
        success: false,
        error: "Reimbursements are currently unavailable",
      };
    }

    // Resolve the owner from the session so we can stamp per-file permissions.
    const { account } = await createSessionClient();
    const user = await account.get().catch(() => null);
    if (!user?.$id) {
      return {
        success: false,
        error: "You must be signed in to upload a receipt.",
      };
    }

    const file = formData.get("file") as File;

    if (!file) {
      return {
        success: false,
        error: "No file provided",
      };
    }

    if (!isAllowedReceiptMimeType(file.type)) {
      return {
        success: false,
        error: `Unsupported file type. Please upload a ${ALLOWED_RECEIPT_LABEL} file.`,
      };
    }

    // The expenses bucket carries no user-level create grant (fileSecurity is
    // on and broad bucket creates are disallowed), so upload through the admin
    // client and stamp owner permissions — reproducing the creator-owner ACL
    // Appwrite used to assign on a session upload. Reviewers and ledger posting
    // read receipts through the admin client, which bypasses file security.
    const { storage } = await createAdminClient();
    const owner = Role.user(user.$id);
    const inputFile = InputFile.fromBuffer(
      Buffer.from(await file.arrayBuffer()),
      file.name
    );
    const result = await storage.createFile(
      "expenses", // Bucket ID
      ID.unique(),
      inputFile,
      [
        Permission.read(owner),
        Permission.update(owner),
        Permission.delete(owner),
      ]
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
