import { ID, type Models, Query } from "@repo/api";
import { appwriteErrorStatus, orNullIfNotFound } from "@repo/api/errors";
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
  type ExpensePayload,
  type ExpenseRowInput,
  parseExpensePayload,
} from "@/lib/expense-payload";
import { generateExpensePdf } from "@/lib/pdf/expense-pdf";

export type CreateExpenseData = Models.Row &
  ExpenseRowInput & {
    invoice_id?: number | null;
  };

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

type ExpenseStatusUpdateRow = Models.Row & { status: ExpensesStatus };

/** Profile with every field required for submission present (narrowed). */
type CompleteProfile = Users & {
  bank_account: string;
  email: string;
  name: string;
  phone: string;
};

/** What both submission flows need once the draft is saved. */
interface Submission {
  expense: Expenses;
  profile: CompleteProfile;
  reimbursementNumber: string;
  submitterId: string;
  submitterIsFinancialManager: boolean;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_ERROR = 500;

const EXPENSES_BUCKET = "expenses";

const SUBMITTED_EXPENSE_COLUMNS = [
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
];

/**
 * A client-facing rejection. Submit steps throw it to stop the flow, and the
 * route answers with its status, message, and `details` verbatim.
 */
class SubmitRejection extends Error {
  readonly details?: Record<string, string>;
  readonly status: number;

  constructor(
    status: number,
    message: string,
    details?: Record<string, string>
  ) {
    super(message);
    this.name = "SubmitRejection";
    this.status = status;
    this.details = details;
  }
}

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
    code === HTTP_CONFLICT ||
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

/**
 * Resolves the caller from their JWT and loads their profile. Rejects before
 * anything is written when the profile lacks a field the reimbursement needs.
 */
async function loadSubmitter(req: NextRequest) {
  const { db, account } = await createAuthenticatedClient(req);
  const user = await account.get().catch((error: unknown) => {
    if (appwriteErrorStatus(error) === HTTP_UNAUTHORIZED) {
      throw new SubmitRejection(HTTP_UNAUTHORIZED, "Unauthorized");
    }
    throw error;
  });

  const profile = await orNullIfNotFound(
    db.getRow<Users>("app", "user", user.$id)
  );
  if (!profile) {
    throw new SubmitRejection(HTTP_NOT_FOUND, "Profile not found");
  }
  if (!isProfileComplete(profile)) {
    throw new SubmitRejection(HTTP_BAD_REQUEST, "Missing required fields: ", {
      missingFields: findMissingProfileFields(profile).join(", "),
    });
  }

  return { db, profile, userId: user.$id };
}

async function readExpensePayload(req: NextRequest): Promise<ExpensePayload> {
  const body: unknown = await req.json().catch(() => {
    throw new SubmitRejection(HTTP_BAD_REQUEST, "Malformed JSON body");
  });

  const payload = parseExpensePayload(body);
  if (!payload) {
    throw new SubmitRejection(HTTP_BAD_REQUEST, "Invalid expense payload");
  }
  if (!payload.bank_account) {
    throw new SubmitRejection(HTTP_BAD_REQUEST, "Bank account is required");
  }

  return payload;
}

async function assertOwnedDraft(
  db: AdminClient["db"],
  expenseId: string,
  userId: string
): Promise<void> {
  const existingExpense = await orNullIfNotFound(
    db.getRow<Expenses>("app", "expense", expenseId, [
      Query.select(["$id", "status", "userId"]),
    ])
  );

  if (!existingExpense) {
    throw new SubmitRejection(HTTP_NOT_FOUND, "Expense not found");
  }
  if (existingExpense.userId !== userId) {
    throw new SubmitRejection(HTTP_FORBIDDEN, "Unauthorized access");
  }
  if (existingExpense.status !== ExpensesStatus.DRAFT) {
    throw new SubmitRejection(
      HTTP_CONFLICT,
      "Only draft expenses can be submitted"
    );
  }
}

async function saveDraftBeforeSubmission(
  adminDb: AdminClient["db"],
  payload: ExpensePayload,
  userId: string
): Promise<CreateExpenseData> {
  const { expenseId } = payload;
  const expenseBody = buildExpenseRowInput(
    payload,
    userId,
    ExpensesStatus.DRAFT
  );

  if (!expenseId) {
    return adminDb.createRow<CreateExpenseData>(
      "app",
      "expense",
      ID.unique(),
      expenseBody,
      buildExpenseRowPermissions(userId)
    );
  }

  // Expense rows are read-only to their submitter: ownership is checked here
  // and the write goes through the admin client.
  await assertOwnedDraft(adminDb, expenseId, userId);
  return adminDb.updateRow<CreateExpenseData>(
    "app",
    "expense",
    expenseId,
    expenseBody
  );
}

/**
 * New flow: route through Teams/Outlook approval + direct ledger posting
 * instead of emailing accounting. The PDF + ledger posting happen after the
 * final approval (see post-pending). createApprovalChain also moves the expense
 * to `pending` before notifying, so there's no separate status update to fail.
 */
async function submitForApproval({
  expense,
  profile,
  reimbursementNumber,
  submitterIsFinancialManager,
}: Submission): Promise<void> {
  // Exactly-once chain creation. The `expense_approvals` table has a UNIQUE
  // index on (expense_id, step), so if two submits of the same draft race past
  // the draft-status check in assertOwnedDraft, only the first creates the
  // chain; the second's step-1 insert fails with a 409 row conflict. We surface
  // that as "already submitting" rather than creating a duplicate chain — no
  // lock column needed (the database constraint is the claim).
  try {
    await createApprovalChain({
      expenseId: expense.$id,
      campusId: expense.campus,
      departmentId: expense.department ?? null,
      departmentName: expense.departmentRel?.Name ?? null,
      submitterIsFinancialManager,
      reimbursementNumber,
      submitterName: profile.name,
      departmentLabel: expense.departmentRel?.Name ?? expense.department,
      campusLabel: expense.campusRel?.name ?? expense.campus,
      total: expense.total,
      currency: "NOK",
      description: expense.description ?? "",
    });
  } catch (error) {
    if (isRowConflictError(error)) {
      throw new SubmitRejection(
        HTTP_CONFLICT,
        "This expense is already being submitted."
      );
    }
    throw error;
  }
}

/**
 * Renders and stores the PDF cover sheet, then returns the email attachment
 * ids: the cover sheet first, followed by the receipts.
 */
async function storeEmailAttachments(
  storage: AdminClient["storage"],
  { expense, profile, reimbursementNumber }: Submission
): Promise<string[]> {
  const addressParts = [profile.address, profile.zip, profile.city].filter(
    Boolean
  );

  const pdfBuffer = await generateExpensePdf({
    reimbursementNumber,
    name: profile.name,
    address: addressParts.join(", ") || "Ikke oppgitt",
    phone: profile.phone,
    email: profile.email,
    bankAccount: profile.bank_account,
    invoiceDate: formatDate(new Date()),
    campusAndUnit: `${expense.departmentRel.Name} - ${expense.campusRel.name}`,
    purpose: expense.description ?? "",
    attachments: expense.expenseAttachments.map((att) => ({
      description: att.description ?? "",
      date: att.date ? formatDate(new Date(att.date)) : "",
      amount: att.amount ?? 0,
    })),
    subtotal: expense.total,
    total: expense.total,
  });

  const uploadedPdf = await storage.createFile(
    EXPENSES_BUCKET,
    ID.unique(),
    InputFile.fromBuffer(pdfBuffer, `refusjon-${reimbursementNumber}.pdf`)
  );

  return [
    `${EXPENSES_BUCKET}:${uploadedPdf.$id}`,
    ...expense.expenseAttachments.map(
      (attachment) => `${EXPENSES_BUCKET}:${attachment.url}`
    ),
  ];
}

/**
 * Legacy flow: emails the cover sheet and receipts to the submitter and to
 * accounting, then marks the expense `pending`.
 */
async function submitByEmail(
  { db, messaging, storage }: AdminClient,
  submission: Submission
): Promise<void> {
  // Appwrite Messaging only delivers to registered users, so accounting's inbox
  // is backed by a dedicated user. Checked before anything is sent, so a missing
  // env var can't email the submitter for a submission that then fails.
  const invoiceUserId = process.env.INVOICE_USER_ID;
  if (!invoiceUserId) {
    throw new Error("INVOICE_USER_ID environment variable is not set");
  }

  const { expense, profile, reimbursementNumber, submitterId } = submission;
  const attachments = await storeEmailAttachments(storage, submission);

  await messaging.createEmail({
    messageId: ID.unique(),
    subject: `Expense ${reimbursementNumber} has been received`,
    content: `
    <h1>Expense received</h1>
    <p>Expense ${expense.$id} has been received</p>
    <p>Reimbursement number: ${reimbursementNumber}</p>
`,
    users: [submitterId],
    attachments,
    html: true,
  });

  await messaging.createEmail({
    messageId: ID.unique(),
    subject: `User ${profile.name} has submitted expense ${reimbursementNumber}`,
    content: `
    <h1>Hello,</h1>

    <p>${profile.name} has submitted a new reimbursement for ${expense.departmentRel.Name} campus ${expense.campusRel.name}</p>
    <p>Reimbursement number: ${reimbursementNumber}</p>
    <p>Best regards,</p>
    <p>BISO Invoice</p>
`,
    users: [invoiceUserId],
    attachments,
    html: true,
  });

  await db.updateRow<ExpenseStatusUpdateRow>("app", "expense", expense.$id, {
    status: ExpensesStatus.PENDING,
  });
}

/** Saves the payload as a draft, then hands it to the active submission flow. */
async function submitExpense(req: NextRequest) {
  if (!(await isFeatureEnabled("expenses_module"))) {
    throw new SubmitRejection(
      HTTP_FORBIDDEN,
      "Reimbursements are currently unavailable"
    );
  }

  const { db, profile, userId } = await loadSubmitter(req);
  const payload = await readExpensePayload(req);
  const admin = await createAdminClient();

  const draft = await saveDraftBeforeSubmission(admin.db, payload, userId);
  const expense = await db.getRow<Expenses>("app", "expense", draft.$id, [
    Query.select(SUBMITTED_EXPENSE_COLUMNS),
  ]);

  const submission: Submission = {
    expense,
    profile,
    reimbursementNumber: generateReimbursementNumber(expense.$sequence),
    submitterId: userId,
    submitterIsFinancialManager: Boolean(
      payload.submitter_is_financial_manager
    ),
  };

  if (await isFeatureEnabled("expenses_ledger_posting")) {
    await submitForApproval(submission);
  } else {
    await submitByEmail(admin, submission);
  }

  return {
    success: true,
    fetchedExpense: expense,
    reimbursementNumber: submission.reimbursementNumber,
  };
}

/**
 * Maps a failure from the submit flow to an HTTP status and a client-safe
 * body. Never serializes the raw error.
 */
function submitErrorResponse(error: unknown): {
  body: Record<string, unknown>;
  status: number;
} {
  if (error instanceof SubmitRejection) {
    return {
      body: { success: false, error: error.message, ...error.details },
      status: error.status,
    };
  }
  return {
    body: { success: false, error: "Failed to submit expense" },
    status: HTTP_INTERNAL_ERROR,
  };
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  try {
    const body = await submitExpense(req);
    return applyCorsHeaders(NextResponse.json(body), origin);
  } catch (error) {
    if (!(error instanceof SubmitRejection)) {
      console.error("Error creating expense:", error);
    }
    const { body, status } = submitErrorResponse(error);
    return applyCorsHeaders(NextResponse.json(body, { status }), origin);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
