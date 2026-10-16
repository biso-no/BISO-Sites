import { ID, type Models, Permission, Query, Role } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type ExpenseAttachments,
  type Expenses,
  ExpensesStatus,
} from "@repo/api/types/appwrite";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import {
  buildExpenseRowInput,
  buildExpenseRowPermissions,
  type ExpenseRowInput,
  parseExpensePayload,
  receiptFileId,
  receiptFileIds,
} from "@/lib/expense-payload";

type DraftExpenseRow = Models.Row & ExpenseRowInput;

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

type AdminStorage = Awaited<ReturnType<typeof createAdminClient>>["storage"];

const EXPENSES_BUCKET = "expenses";

/**
 * How many attachment rows are inspected per receipt. A receipt is normally
 * referenced once; anything beyond a handful means the picture is unclear,
 * and an unclear picture is not a licence to delete.
 */
const REFERENCE_PROBE_LIMIT = 5;

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
 * Whether the caller owns this file in the `expenses` bucket.
 *
 * An attachment's `url` is free-form client input, so a draft can be made to
 * point at any file id in the bucket. Receipts are uploaded readable by their
 * uploader and nobody else, so the read grant is what identifies the file as
 * the caller's own; anything else — another student's receipt, a file whose
 * metadata cannot be read — is left alone.
 */
async function callerOwnsReceipt(
  storage: AdminStorage,
  fileId: string,
  userId: string
): Promise<boolean> {
  const file = await storage
    .getFile(EXPENSES_BUCKET, fileId)
    .catch((error: unknown) => {
      console.error(
        `[expenses/draft] Could not read receipt ${fileId}; leaving it:`,
        error
      );
      return null;
    });

  if (!file) {
    return false;
  }

  if (!file.$permissions?.includes(Permission.read(Role.user(userId)))) {
    console.error(
      `[expenses/draft] Receipt ${fileId} is not the caller's; leaving it.`
    );
    return false;
  }

  return true;
}

/**
 * Whether this draft is the only expense pointing at the file.
 *
 * The same file id can be copied into a throwaway draft while an already
 * submitted or approved expense still shows it as its receipt — deleting the
 * file then destroys the evidence behind a payout. `expense_attachments` is
 * the child of a one-way relationship and carries no parent column, so the
 * draft's own attachment row ids are the reference: any referencing row that
 * is not one of them belongs to another expense.
 *
 * The probe cannot be an equality match on the bare id alone. Older rows
 * stored the whole view URL, and those are exactly the rows most likely to
 * belong to an expense that is already approved — an exact match would never
 * return one, and the file would be deleted as if unreferenced. So the query
 * is widened with a substring match (which the `departments` search shows
 * works on a plain string column, index or not), and the comparison is
 * between resolved file ids rather than raw `url` strings. A substring match
 * over-matches rather than under-matches, which is the safe direction: an
 * unrelated row is ignored once its `url` resolves to a different id.
 */
async function onlyThisDraftReferences(
  db: AdminDb,
  fileId: string,
  ownAttachmentRowIds: ReadonlySet<string>
): Promise<boolean> {
  const referencing = await db
    .listRows<ExpenseAttachments>("app", "expense_attachments", [
      Query.or([Query.equal("url", fileId), Query.contains("url", fileId)]),
      Query.limit(REFERENCE_PROBE_LIMIT),
    ])
    .catch((error: unknown) => {
      console.error(
        `[expenses/draft] Could not check who references ${fileId}; leaving it:`,
        error
      );
      return null;
    });

  if (!referencing) {
    return false;
  }

  if (referencing.total > referencing.rows.length) {
    console.error(
      `[expenses/draft] Receipt ${fileId} has more references than were read; leaving it.`
    );
    return false;
  }

  const foreign = referencing.rows.find(
    (row) =>
      receiptFileId(row.url) === fileId && !ownAttachmentRowIds.has(row.$id)
  );
  if (foreign) {
    console.error(
      `[expenses/draft] Receipt ${fileId} is still referenced by ${foreign.$id}; leaving it.`
    );
    return false;
  }

  return true;
}

/**
 * The subset of a draft's receipt file ids this request may delete: the
 * caller's own files, referenced by this draft and nothing else.
 */
async function deletableReceiptIds(
  clients: { db: AdminDb; storage: AdminStorage },
  fileIds: string[],
  userId: string,
  ownAttachmentRowIds: ReadonlySet<string>
): Promise<string[]> {
  const verdicts = await Promise.all(
    fileIds.map(async (fileId) => {
      const allowed =
        (await callerOwnsReceipt(clients.storage, fileId, userId)) &&
        (await onlyThisDraftReferences(
          clients.db,
          fileId,
          ownAttachmentRowIds
        ));
      return allowed ? fileId : null;
    })
  );

  return verdicts.filter((fileId): fileId is string => fileId !== null);
}

/**
 * Deletes one of the caller's own drafts, and the receipt files it
 * referenced. Submitted expenses are never deletable here: once a draft has
 * left draft, it belongs to the approval and posting flow.
 *
 * A receipt is only deleted when it is both the caller's own file and
 * referenced by this draft alone — see `callerOwnsReceipt` and
 * `onlyThisDraftReferences`. The file ids come from attachment `url`s, which
 * are client input, so without those two checks a throwaway draft naming any
 * file id would be enough to delete it.
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

    // Which receipts may go is settled while the draft's own attachment rows
    // still exist, so they can be told apart from another expense's.
    const ownAttachmentRowIds = new Set(
      (expense.expenseAttachments ?? []).map((attachment) => attachment.$id)
    );
    const deletable = await deletableReceiptIds(
      { db, storage },
      receiptFileIds(expense.expenseAttachments),
      userId,
      ownAttachmentRowIds
    );

    // `expenseAttachments` cascades, so the attachment rows go with the draft.
    await db.deleteRow("app", "expense", expenseId);

    await Promise.all(
      deletable.map((fileId) =>
        storage.deleteFile(EXPENSES_BUCKET, fileId).catch((error: unknown) => {
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
