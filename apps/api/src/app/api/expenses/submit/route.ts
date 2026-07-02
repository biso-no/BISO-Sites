import { ID, type Models, Query } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import { type Expenses, ExpensesStatus } from "@repo/api/types/appwrite";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { createApprovalChain } from "@/lib/expense-approval";
import {
  buildExpenseRowInput,
  buildExpenseRowPermissions,
  type ExpenseRowInput,
  parseExpensePayload,
} from "@/lib/expense-payload";
import { generateExpensePdf } from "@/lib/pdf/expense-pdf";

export type CreateExpenseData = Models.Row &
  ExpenseRowInput & {
    invoice_id?: number | null;
  };

type ExpenseOwnershipResult =
  | { ok: true }
  | { error: string; ok: false; status: number };

type ExpenseOwnershipError = Extract<ExpenseOwnershipResult, { ok: false }>;

function isExpenseOwnershipError(
  result: CreateExpenseData | ExpenseOwnershipError
): result is ExpenseOwnershipError {
  return "ok" in result && !result.ok;
}

async function checkDraftOwnership(
  db: Awaited<ReturnType<typeof createAuthenticatedClient>>["db"],
  expenseId: string,
  userId: string
): Promise<ExpenseOwnershipResult> {
  const existingExpense = await db.getRow<Expenses>(
    "app",
    "expense",
    expenseId,
    [Query.select(["$id", "status", "userId"])]
  );

  if (existingExpense.userId !== userId) {
    return {
      ok: false,
      error: "Unauthorized access",
      status: 403,
    };
  }

  if (existingExpense.status !== ExpensesStatus.DRAFT) {
    return {
      ok: false,
      error: "Only draft expenses can be submitted",
      status: 409,
    };
  }

  return { ok: true };
}

async function saveDraftBeforeSubmission(
  db: Awaited<ReturnType<typeof createAuthenticatedClient>>["db"],
  adminDb: Awaited<ReturnType<typeof createAdminClient>>["db"],
  expenseId: string | undefined,
  userId: string,
  expenseBody: ExpenseRowInput
): Promise<CreateExpenseData | ExpenseOwnershipError> {
  if (!expenseId) {
    return adminDb.createRow<CreateExpenseData>(
      "app",
      "expense",
      ID.unique(),
      expenseBody,
      buildExpenseRowPermissions(userId)
    );
  }

  const ownership = await checkDraftOwnership(db, expenseId, userId);

  if (!ownership.ok) {
    return ownership;
  }

  return db.updateRow<CreateExpenseData>(
    "app",
    "expense",
    expenseId,
    expenseBody
  );
}

type ExpenseStatusUpdateRow = Models.Row & { status: ExpensesStatus };

/**
 * True when an Appwrite write failed because a unique constraint (e.g. the
 * approval chain's unique (expense_id, step) index) already holds the row —
 * i.e. a concurrent submit already created the chain.
 */
function isRowConflictError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { code, type } = error as { code?: unknown; type?: unknown };
  return (
    code === 409 ||
    type === "row_already_exists" ||
    type === "document_already_exists"
  );
}

/**
 * Generates a 5-digit reimbursement number from the sequence.
 * Base is 10000, sequence is added to the last digits.
 * E.g., sequence 80 -> 10080, sequence 150 -> 10150
 */
function generateReimbursementNumber(sequence: number | string): string {
  const base = 10_000;
  return String(base + Number(sequence || 0)).padStart(5, "0");
}

/**
 * Formats a date string for display in Norwegian format
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Profile with every field required for submission present (narrowed). */
type CompleteProfile = Users & {
  bank_account: string;
  email: string;
  name: string;
  phone: string;
};

/** Returns the names of the profile fields required for submission that are unset. */
function findMissingProfileFields(profile: Users): string[] {
  const required: [keyof Users, string][] = [
    ["name", "name"],
    ["phone", "phone"],
    ["email", "email"],
    ["bank_account", "bank_account"],
  ];
  return required.filter(([key]) => !profile[key]).map(([, label]) => label);
}

/** Type guard narrowing a profile once all submission-required fields are set. */
function isProfileComplete(profile: Users): profile is CompleteProfile {
  return Boolean(
    profile.name && profile.phone && profile.email && profile.bank_account
  );
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

    const { db, account } = await createAuthenticatedClient(req);
    const {
      db: adminDb,
      messaging,
      storage: adminStorage,
    } = await createAdminClient();
    const user = await account.get();
    const profile = await db.getRow<Users>("app", "user", user.$id);

    const expenseData = parseExpensePayload(await req.json());

    if (!expenseData) {
      return applyCorsHeaders(
        NextResponse.json(
          {
            success: false,
            error: "Invalid expense payload",
          },
          { status: 400 }
        ),
        origin
      );
    }

    if (!expenseData?.bank_account) {
      return applyCorsHeaders(
        NextResponse.json({
          success: false,
          error: "Bank account is required",
        }),
        origin
      );
    }

    const expenseBody = buildExpenseRowInput(
      expenseData,
      user.$id,
      ExpensesStatus.DRAFT
    );

    const expense = await saveDraftBeforeSubmission(
      db,
      adminDb,
      expenseData.expenseId,
      user.$id,
      expenseBody
    );

    if (isExpenseOwnershipError(expense)) {
      return applyCorsHeaders(
        NextResponse.json(
          { success: false, error: expense.error },
          { status: expense.status }
        ),
        origin
      );
    }

    const fetchedExpense = await db.getRow<Expenses>(
      "app",
      "expense",
      expense.$id,
      [
        Query.select([
          "$id",
          "campus",
          "department",
          "bank_account",
          "description",
          "total",
          "prepayment_amount",
          "status",
          "invoice_id",
          "user.*",
          "userId",
          "eventName",
          "departmentRel.*",
          "campusRel.*",
          "expenseAttachments.*",
          "$sequence",
        ]),
      ]
    );

    // Generate reimbursement number from sequence
    const reimbursementNumber = generateReimbursementNumber(
      fetchedExpense.$sequence
    );

    // Build address string
    const addressParts = [profile.address, profile.zip, profile.city].filter(
      Boolean
    );
    const fullAddress = addressParts.join(", ") || "Ikke oppgitt";

    if (!isProfileComplete(profile)) {
      return applyCorsHeaders(
        NextResponse.json({
          success: false,
          error: "Missing required fields: ",
          missingFields: findMissingProfileFields(profile).join(", "),
        }),
        origin
      );
    }

    // New flow: route through Teams/Outlook approval + direct ledger posting
    // instead of emailing accounting. The PDF + ledger posting happen after the
    // final approval (see post-pending).
    if (await isFeatureEnabled("expenses_ledger_posting")) {
      // Exactly-once chain creation. The `expense_approvals` table has a UNIQUE
      // index on (expense_id, step), so if two submits of the same draft race past
      // the draft-status check above, only the first creates the chain; the second's
      // step-1 insert fails with a 409 row conflict. We surface that as
      // "already submitting" rather than creating a duplicate chain — no lock column
      // needed (the database constraint is the claim).
      try {
        await createApprovalChain({
          expenseId: expense.$id,
          campusId: fetchedExpense.campus,
          departmentId: fetchedExpense.department ?? null,
          departmentName: fetchedExpense.departmentRel?.Name ?? null,
          submitterIsFinancialManager: Boolean(
            expenseData.submitter_is_financial_manager
          ),
          reimbursementNumber,
          submitterName: profile.name,
          departmentLabel:
            fetchedExpense.departmentRel?.Name ?? fetchedExpense.department,
          campusLabel: fetchedExpense.campusRel?.name ?? fetchedExpense.campus,
          total: fetchedExpense.total,
          currency: "NOK",
          description: fetchedExpense.description ?? "",
        });
      } catch (error) {
        if (isRowConflictError(error)) {
          return applyCorsHeaders(
            NextResponse.json(
              {
                success: false,
                error: "This expense is already being submitted.",
              },
              { status: 409 }
            ),
            origin
          );
        }
        throw error;
      }

      // createApprovalChain already transitioned the expense to `pending` (before
      // notifying), so there's no separate status update to fail here.
      return applyCorsHeaders(
        NextResponse.json({
          success: true,
          fetchedExpense,
          reimbursementNumber,
        }),
        origin
      );
    }

    // Generate the PDF cover sheet
    const pdfBuffer = await generateExpensePdf({
      reimbursementNumber,
      name: profile.name,
      address: fullAddress,
      phone: profile.phone,
      email: profile.email,
      bankAccount: profile.bank_account,
      invoiceDate: formatDate(new Date()),
      campusAndUnit: `${fetchedExpense.departmentRel.Name} - ${fetchedExpense.campusRel.name}`,
      purpose: fetchedExpense.description ?? "",
      attachments: fetchedExpense.expenseAttachments.map((att) => ({
        description: att.description ?? "",
        date: att.date ? formatDate(new Date(att.date)) : "",
        amount: att.amount ?? 0,
      })),
      subtotal: fetchedExpense.total,
      total: fetchedExpense.total,
    });

    // Upload the PDF to storage
    const pdfFileName = `refusjon-${reimbursementNumber}.pdf`;
    const uploadedPdf = await adminStorage.createFile(
      "expenses",
      ID.unique(),
      InputFile.fromBuffer(pdfBuffer, pdfFileName)
    );

    // Prepend the PDF to the attachments array
    const attachmentsIdsArray = [
      `expenses:${uploadedPdf.$id}`,
      ...fetchedExpense.expenseAttachments.map(
        (attachment) => `expenses:${attachment.url}`
      ),
    ];

    const emailHtml = `
    <h1>Expense received</h1>
    <p>Expense ${expense.$id} has been received</p>
    <p>Reimbursement number: ${reimbursementNumber}</p>
`;

    const invoiceEmailHtml = `
    <h1>Hello,</h1>
    
    <p>${profile.name} has submitted a new reimbursement for ${fetchedExpense.departmentRel.Name} campus ${fetchedExpense.campusRel.name}</p>
    <p>Reimbursement number: ${reimbursementNumber}</p>
    <p>Best regards,</p>
    <p>BISO Invoice</p>
`;

    await messaging.createEmail(
      ID.unique(),
      `Expense ${reimbursementNumber} has been received`,
      emailHtml,
      undefined,
      [user.$id],
      undefined,
      undefined,
      undefined,
      attachmentsIdsArray
    );

    await messaging.createEmail(
      ID.unique(),
      `User ${profile.name} has submitted expense ${reimbursementNumber}`,
      invoiceEmailHtml,
      undefined,
      ["invoice"],
      undefined,
      undefined,
      undefined,
      attachmentsIdsArray
    );

    await db.updateRow<ExpenseStatusUpdateRow>("app", "expense", expense.$id, {
      status: ExpensesStatus.PENDING,
    });

    return applyCorsHeaders(
      NextResponse.json({
        success: true,
        fetchedExpense,
        reimbursementNumber,
      }),
      origin
    );
  } catch (error) {
    console.error("Error creating expense:", error);
    return applyCorsHeaders(
      NextResponse.json({ success: false, error }),
      origin
    );
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
