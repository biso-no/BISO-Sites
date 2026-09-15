import { ID, type Models, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { type Expenses, ExpensesStatus } from "@repo/api/types/appwrite";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import {
  buildExpenseRowInput,
  buildExpenseRowPermissions,
  type ExpenseRowInput,
  parseExpensePayload,
  receiptFileIds,
} from "@/lib/expense-payload";

type DraftExpenseRow = Models.Row & ExpenseRowInput;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function assertDraftOwnership(
  db: AdminDb,
  expenseId: string,
  userId: string
): Promise<NextResponse | null> {
  const existingExpense = await db.getRow<Expenses>(
    "app",
    "expense",
    expenseId,
    [Query.select(["$id", "status", "userId"])]
  );

  if (existingExpense.userId !== userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized access" },
      { status: 403 }
    );
  }

  if (existingExpense.status !== ExpensesStatus.DRAFT) {
    return NextResponse.json(
      { success: false, error: "Only draft expenses can be updated" },
      { status: 409 }
    );
  }

  return null;
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    if (!(await isFeatureEnabled("expenses_module"))) {
      return applyCorsHeaders(
        NextResponse.json(
          { success: false, error: "Reimbursements are currently unavailable" },
          { status: 403 }
        ),
        origin
      );
    }

    const { account } = await createAuthenticatedClient(req);
    const user = await account.get();
    const payload = parseExpensePayload(await req.json());

    if (!payload) {
      return applyCorsHeaders(
        NextResponse.json(
          { success: false, error: "Invalid draft expense payload" },
          { status: 400 }
        ),
        origin
      );
    }

    const expenseBody = buildExpenseRowInput(
      payload,
      user.$id,
      ExpensesStatus.DRAFT
    );

    const draft = payload.expenseId
      ? await updateDraftExpense(payload.expenseId, user.$id, expenseBody)
      : await createDraftExpense(user.$id, expenseBody);

    if (draft instanceof NextResponse) {
      return applyCorsHeaders(draft, origin);
    }

    return applyCorsHeaders(
      NextResponse.json({ success: true, draft }),
      origin
    );
  } catch (error) {
    console.error("Error saving expense draft:", error);
    return applyCorsHeaders(
      NextResponse.json(
        { success: false, error: "Failed to save draft" },
        { status: 500 }
      ),
      origin
    );
  }
}

async function createDraftExpense(
  userId: string,
  expenseBody: ExpenseRowInput
) {
  const { db } = await createAdminClient();
  return await db.createRow<DraftExpenseRow>(
    "app",
    "expense",
    ID.unique(),
    expenseBody,
    buildExpenseRowPermissions(userId)
  );
}

/**
 * Expense rows are read-only to their submitter, so this ownership check is
 * the only thing between the caller and the row: the read and the write both
 * use the admin client.
 */
async function updateDraftExpense(
  expenseId: string,
  userId: string,
  expenseBody: ExpenseRowInput
) {
  const { db } = await createAdminClient();
  const ownershipError = await assertDraftOwnership(db, expenseId, userId);

  if (ownershipError) {
    return ownershipError;
  }

  return db.updateRow<DraftExpenseRow>(
    "app",
    "expense",
    expenseId,
    expenseBody
  );
}

function isNotFound(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === 404;
}

/**
 * Deletes one of the caller's own drafts, and the receipt files it
 * referenced. Submitted expenses are never deletable here: once a draft has
 * left draft, it belongs to the approval and posting flow.
 */
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  const expenseId = new URL(req.url).searchParams.get("expenseId")?.trim();
  if (!expenseId) {
    return json({ success: false, error: "Missing expenseId" }, 400);
  }

  let userId: string;
  try {
    const { account } = await createAuthenticatedClient(req);
    userId = (await account.get()).$id;
  } catch {
    return json({ success: false, error: "Authentication required" }, 401);
  }

  try {
    const { db, storage } = await createAdminClient();
    const expense = await db
      .getRow<Expenses>("app", "expense", expenseId, [
        Query.select(["$id", "status", "userId", "expenseAttachments.*"]),
      ])
      .catch((error: unknown) => {
        if (isNotFound(error)) {
          return null;
        }
        throw error;
      });

    if (!expense) {
      return json({ success: false, error: "Expense not found" }, 404);
    }
    if (expense.userId !== userId) {
      return json({ success: false, error: "Unauthorized access" }, 403);
    }
    if (expense.status !== ExpensesStatus.DRAFT) {
      return json(
        { success: false, error: "Only draft expenses can be deleted" },
        409
      );
    }

    // `expenseAttachments` cascades, so the attachment rows go with the draft.
    await db.deleteRow("app", "expense", expenseId);

    await Promise.all(
      receiptFileIds(expense.expenseAttachments).map((fileId) =>
        storage.deleteFile("expenses", fileId).catch((error: unknown) => {
          console.error(
            `[expenses/draft] Could not delete receipt ${fileId}:`,
            error
          );
        })
      )
    );

    return json({ success: true });
  } catch (error) {
    console.error("Error deleting expense draft:", error);
    return json({ success: false, error: "Failed to delete draft" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
