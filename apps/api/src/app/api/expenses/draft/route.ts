import { ID, type Models, Query } from "@repo/api";
import { ExpenseStatus, type Expenses } from "@repo/api/types/appwrite";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import {
  buildExpenseRowInput,
  type ExpenseRowInput,
  parseExpensePayload,
} from "@/lib/expense-payload";

type DraftExpenseRow = Models.Row & ExpenseRowInput;

async function assertDraftOwnership(
  db: Awaited<ReturnType<typeof createAuthenticatedClient>>["db"],
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

  if (existingExpense.status !== ExpenseStatus.DRAFT) {
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
    const { db, account } = await createAuthenticatedClient(req);
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
      ExpenseStatus.DRAFT
    );

    const draft = payload.expenseId
      ? await updateDraftExpense(db, payload.expenseId, user.$id, expenseBody)
      : await db.createRow<DraftExpenseRow>(
          "app",
          "expense",
          ID.unique(),
          expenseBody
        );

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

async function updateDraftExpense(
  db: Awaited<ReturnType<typeof createAuthenticatedClient>>["db"],
  expenseId: string,
  userId: string,
  expenseBody: ExpenseRowInput
) {
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

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
