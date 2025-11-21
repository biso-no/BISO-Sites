"use server";

import { ID, Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type ExpenseAttachments,
  ExpenseStatus,
  type Expenses,
} from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";

// Type for creating an expense - omits relational fields that are populated by the database
type CreateExpenseInput = Omit<
  Expenses,
  | keyof import("@repo/api").Models.Row
  | "user"
  | "departmentRel"
  | "expenseAttachments"
> & {
  expenseAttachments: string[];
};

// Type for creating an expense attachment
type CreateExpenseAttachmentInput = Omit<
  ExpenseAttachments,
  keyof import("@repo/api").Models.Row
>;

/**
 * Get all expenses for the current user with optional filters
 */
export async function getExpenses(filters?: {
  status?: ExpenseStatus;
  campus?: string;
}) {
  try {
    const { db, account } = await createSessionClient();
    const user = await account.get();

    const queries = [
      Query.equal("userId", user.$id),
      Query.orderDesc("$createdAt"),
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
 * Create a new expense
 */
export async function createExpense(data: {
  campus: string;
  department: string;
  bank_account: string;
  description?: string;
  expenseAttachments: string[]; // Array of attachment IDs
  total: number;
  prepayment_amount?: number;
  eventName?: string;
}) {
  try {
    const { db, account } = await createSessionClient();
    const user = await account.get();

    const expenseData: CreateExpenseInput = {
      campus: data.campus,
      department: data.department,
      bank_account: data.bank_account,
      description: data.description || null,
      expenseAttachments: data.expenseAttachments,
      total: data.total,
      prepayment_amount: data.prepayment_amount || null,
      status: ExpenseStatus.PENDING,
      userId: user.$id,
      eventName: data.eventName || null,
      invoice_id: null,
    };

    const expense = await db.createRow<Expenses>(
      "app",
      "expense",
      ID.unique(),
      expenseData as any
    );

    revalidatePath("/fs");

    return {
      success: true,
      expense,
    };
  } catch (error) {
    console.error("Error creating expense:", error);
    return {
      success: false,
      expense: null,
      error:
        error instanceof Error ? error.message : "Failed to create expense",
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

    return {
      success: true,
      file: result,
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

/**
 * Create an expense attachment record in the database
 */
export async function createExpenseAttachment(data: {
  date: string;
  url: string;
  amount: number;
  description: string;
  type: string;
}) {
  try {
    const { db } = await createSessionClient();

    const attachmentData: CreateExpenseAttachmentInput = {
      date: data.date,
      url: data.url,
      amount: data.amount,
      description: data.description,
      type: data.type,
    };

    const attachment = await db.createRow<ExpenseAttachments>(
      "app",
      "expense_attachments",
      ID.unique(),
      attachmentData as any
    );

    return {
      success: true,
      attachment,
    };
  } catch (error) {
    console.error("Error creating attachment record:", error);
    return {
      success: false,
      attachment: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create attachment record",
    };
  }
}

/**
 * Update an existing expense
 */
async function updateExpense(
  expenseId: string,
  data: Partial<CreateExpenseInput>
) {
  try {
    const { db, account } = await createSessionClient();
    const user = await account.get();

    // Verify ownership
    const existingExpense = await db.getRow<Expenses>(
      "app",
      "expense",
      expenseId
    );

    if (existingExpense.userId !== user.$id) {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    const updatedExpense = await db.updateRow<Expenses>(
      "app",
      "expense",
      expenseId,
      data as any
    );

    revalidatePath("/fs");
    revalidatePath(`/fs/${expenseId}`);

    return {
      success: true,
      expense: updatedExpense,
    };
  } catch (error) {
    console.error("Error updating expense:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update expense",
    };
  }
}

/**
 * Delete an expense
 */
async function deleteExpense(expenseId: string) {
  try {
    const { db, account } = await createSessionClient();
    const user = await account.get();

    // Verify ownership
    const existingExpense = await db.getRow<Expenses>(
      "app",
      "expense",
      expenseId
    );

    if (existingExpense.userId !== user.$id) {
      return {
        success: false,
        error: "Unauthorized access",
      };
    }

    await db.deleteRow("app", "expense", expenseId);

    revalidatePath("/fs");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting expense:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete expense",
    };
  }
}
