import { ID, type Models, Query } from "@repo/api";
import { appwriteErrorStatus, orNullIfNotFound } from "@repo/api/errors";
import { createAdminClient } from "@repo/api/server";
import type { Users } from "@repo/api/types/appwrite";
import {
  type Expenses,
  ExpensesCheckState,
  ExpensesStatus,
} from "@repo/api/types/appwrite";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { reimbursementNumber } from "@repo/shared/utils/reimbursement-number";
import { after, type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { runExpenseCheck } from "@/lib/expense-check/run";
import {
  buildExpenseRowInput,
  buildExpenseRowPermissions,
  type ExpensePayload,
  type ExpenseRowInput,
  mergeLegacyDraft,
  parseExpensePayload,
} from "@/lib/expense-payload";
import { withoutProject } from "@/lib/expense-student-view";
import {
  OccasionRequiredError,
  prepareSubmission,
  SubmissionTakenError,
} from "@/lib/expense-submission";

// The answer needs no AI; the check after it (`after()`, see
// `expense-check/run.ts`) runs within this route's time.
export const maxDuration = 300;

export type CreateExpenseData = Models.Row &
  ExpenseRowInput & {
    invoice_id?: number | null;
  };

type SubmittedRow = Models.Row & Pick<Expenses, "check_state" | "status">;

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

/** Profile with every field required for submission present (narrowed). */
type CompleteProfile = Users & {
  bank_account: string;
  email: string;
  name: string;
  phone: string;
};

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_ERROR = 500;

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
  "occasion",
  "event_id",
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

/** The caller's own draft, with what `mergeLegacyDraft` keeps from it. */
async function loadOwnedDraft(
  db: AdminClient["db"],
  expenseId: string,
  userId: string
): Promise<Expenses> {
  const existingExpense = await orNullIfNotFound(
    db.getRow<Expenses>("app", "expense", expenseId, [
      Query.select([
        "$id",
        "status",
        "userId",
        "occasion",
        "event_id",
        "submitter_is_controller",
        "campus",
        "department",
        "expenseAttachments.*",
      ]),
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
  return existingExpense;
}

/** The draft as saved, and the payload behind it. */
interface SavedDraft {
  draft: CreateExpenseData;
  saved: ExpensePayload;
}

/**
 * Saves the payload over the draft and returns it as saved: when an old app
 * submits a draft made on the web, the draft's own type text, occasion, event
 * and controller flag are kept (see `mergeLegacyDraft`).
 */
async function saveDraftBeforeSubmission(
  adminDb: AdminClient["db"],
  payload: ExpensePayload,
  userId: string
): Promise<SavedDraft> {
  const { expenseId } = payload;

  if (!expenseId) {
    const row = buildExpenseRowInput(payload, userId, ExpensesStatus.DRAFT);
    const draft = await adminDb.createRow<CreateExpenseData>(
      "app",
      "expense",
      ID.unique(),
      row,
      buildExpenseRowPermissions(userId)
    );
    return { draft, saved: payload };
  }

  // Expense rows are read-only to their submitter: ownership is checked here
  // and the write goes through the admin client.
  const existing = await loadOwnedDraft(adminDb, expenseId, userId);
  const saved = mergeLegacyDraft(payload, existing);
  const row = buildExpenseRowInput(saved, userId, ExpensesStatus.DRAFT);
  const draft = await adminDb.updateRow<CreateExpenseData>(
    "app",
    "expense",
    expenseId,
    row
  );
  return { draft, saved };
}

/**
 * Settles what needs no AI on the saved draft: types and accounts from the
 * student's choices and stored scans, the occasion rule, hints and history.
 * A missing occasion is the student's to fix, so it is answered as a 400 the
 * client can point at the field. The draft is saved by then, so the answer
 * names it: a client that had never saved the report updates that draft next
 * time instead of making a second one. A draft another submit took while this
 * one prepared it is answered 409, with nothing written.
 */
async function prepareOrReject(
  admin: AdminClient,
  expense: Expenses,
  payload: ExpensePayload,
  profileName: string
): Promise<void> {
  try {
    await prepareSubmission(admin, expense, payload, profileName);
  } catch (error) {
    if (error instanceof OccasionRequiredError) {
      throw new SubmitRejection(HTTP_BAD_REQUEST, "Occasion is required", {
        expenseId: expense.$id,
        field: "occasion",
      });
    }
    if (error instanceof SubmissionTakenError) {
      throw new SubmitRejection(HTTP_CONFLICT, error.message);
    }
    throw error;
  }
}

/**
 * Checks the submitted expense after the answer has gone out. A check that
 * throws is logged; it stays `queued` or `running`, so the backstop runs it.
 */
function checkAfterAnswer(expenseId: string): void {
  after(async () => {
    try {
      await runExpenseCheck(expenseId);
    } catch (error) {
      console.error(
        `[expense-check] check failed for ${expenseId}; the backstop runs it again:`,
        error
      );
    }
  });
}

/** Server-owned booking details (accounts, projects) never go back to the student. */
function studentView(expense: Expenses): Expenses {
  return {
    ...expense,
    expenseAttachments: (expense.expenseAttachments ?? []).map(
      (attachment) => ({
        ...withoutProject(attachment),
        account_number: null,
        account_source: null,
        tax_code: null,
      })
    ),
  };
}

/**
 * Saves the payload as a draft, settles what needs no AI, and submits it: the
 * student sees `pending` in the answer. The AI check, and the approvers' or
 * accounting's notice, follow after the answer (`runExpenseCheck`).
 */
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

  const { draft, saved } = await saveDraftBeforeSubmission(
    admin.db,
    payload,
    userId
  );
  const readExpense = () =>
    db.getRow<Expenses>("app", "expense", draft.$id, [
      Query.select(SUBMITTED_EXPENSE_COLUMNS),
    ]);

  await prepareOrReject(admin, await readExpense(), saved, profile.name);
  // One write, so a submit that fails before it leaves a draft the backstop
  // never sees. Only a draft gets here (`loadOwnedDraft`, and again just
  // before prepare writes); the check's claim lets one run notify.
  await admin.db.updateRow<SubmittedRow>("app", "expense", draft.$id, {
    check_state: ExpensesCheckState.QUEUED,
    status: ExpensesStatus.PENDING,
  });
  // Scheduled at once, so a failure from here on can't lose the check.
  checkAfterAnswer(draft.$id);
  // Read again so the answer shows the expense as submitted.
  const expense = await readExpense();

  return {
    success: true,
    fetchedExpense: studentView(expense),
    reimbursementNumber: reimbursementNumber(expense.$sequence),
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
