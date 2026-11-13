// Posts an approved reimbursement to the 24SevenOffice ledger: builds one merged
// PDF (invoice cover first, then receipts/bank statements in their saved order),
// uploads it, then posts the balanced transaction. Files are kept in storage.

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  ExpenseAttachments,
  ExpenseEvents,
  Expenses,
  Users,
} from "@repo/api/types/appwrite";
import { ExpensesStatus } from "@repo/api/types/appwrite";
import {
  type DateShift,
  type ExpenseReceiptLine,
  type FiscalPeriod,
  type FiscalYearLock,
  getFiscalYearLocks,
  listFiscalPeriods,
  type PostedExpenseTransaction,
  postExpenseTransaction,
  resolveBookingDate,
  uploadDocument,
} from "@repo/connectors/24sevenoffice";
import {
  AI_TYPE_CONFIDENCE_THRESHOLD,
  type CostTypeOption,
  DEFAULT_COST_TYPE_SLUG,
  resolveReceiptAccount,
} from "@repo/shared/utils/expense-cost-types";
import {
  type ExpenseEventInput,
  recordExpenseEvents,
} from "@repo/shared/utils/expense-events";
import { reimbursementNumber } from "@repo/shared/utils/reimbursement-number";
import { PDFDocument } from "pdf-lib";
import type { ApprovalActor } from "./expense-approval";
import { assertApprovedExpenseChain } from "./expense-approval-chain";
import { type BookedExampleInput, writeExamples } from "./expense-examples";
import { loadAllCostTypes } from "./expense-types";
import { generateExpensePdf } from "./pdf/expense-pdf";
import { receiptDateInOslo, todayInOslo } from "./receipt-date";
import { findScan } from "./receipt-scan";

const EXPENSES_BUCKET = "expenses";

// Sentinel written to `ledger_transaction_id` once an expense has been atomically
// claimed (via the `posting_lock` counter) and is in the slow upload/post phase.
// It is overwritten with the real transaction id on success and left in place on
// failure so a failed row is never silently re-posted.
const POSTING_CLAIM_MARKER = "posting";

// A posting run is bounded by the route's maxDuration (5 min). A "posting" claim
// older than this lease therefore belongs to a crashed/timed-out run and is
// reclaimed (surfaced as failed for manual review) rather than blocking forever.
const STALE_POSTING_LEASE_MS = 15 * 60 * 1000;

export type ExpenseWithRels = Expenses & {
  departmentRel: { Id?: string; Name?: string } | null;
  campusRel: { name?: string } | null;
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function sortedAttachments(
  attachments: ExpenseAttachments[]
): ExpenseAttachments[] {
  return [...attachments].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
}

interface BookingContext {
  locks: FiscalYearLock[];
  periods: FiscalPeriod[];
  today: string;
}

function buildReceiptLines(
  attachments: ExpenseAttachments[],
  options: CostTypeOption[],
  booking: BookingContext
): { lines: ExpenseReceiptLine[]; shifts: DateShift[] } {
  const lines: ExpenseReceiptLine[] = [];
  const shifts: DateShift[] = [];
  const bookingDateFor = (att: ExpenseAttachments): string => {
    const receiptDate = receiptDateInOslo(att.date);
    const resolved = resolveBookingDate({
      receiptDate,
      today: booking.today,
      locks: booking.locks,
      periods: booking.periods,
    });
    if (resolved.reason !== null) {
      shifts.push({
        ref: att.$id,
        from: receiptDate ?? "",
        to: resolved.date,
        reason: resolved.reason,
      });
    }
    return resolved.date;
  };
  for (const att of attachments) {
    const amount = att.amount ?? 0;
    if (amount <= 0) {
      // Zero-amount rows are supporting docs (e.g. bank statements) — no GL line.
      continue;
    }
    if (att.account_number) {
      lines.push({
        accountNumber: att.account_number,
        amount,
        taxCode: att.tax_code ?? 0,
        comment: att.description ?? undefined,
        ref: att.$id,
        date: bookingDateFor(att),
      });
      continue;
    }
    // The student's own type has no type account, and nobody has set one.
    // Booking it on "Other" would hide that, so the posting fails visibly.
    const ownText = att.cost_type_text?.trim();
    if (!att.cost_type && ownText) {
      throw new Error(
        `Receipt ${att.$id} has no account for the student's own type "${ownText}"`
      );
    }
    // Normalize empty cost types (e.g. drafts saved before the default existed)
    // to the "Other" slug so a missing choice posts to a valid account rather
    // than failing; a genuinely unknown non-empty slug still throws.
    const resolved = resolveReceiptAccount(
      att.cost_type || DEFAULT_COST_TYPE_SLUG,
      options
    );
    lines.push({
      accountNumber: resolved.accountNumber,
      amount,
      taxCode: resolved.taxCode,
      comment: att.description ?? undefined,
      ref: att.$id,
      date: bookingDateFor(att),
    });
  }
  return { lines, shifts };
}

async function loadFiscalContext(): Promise<{
  locks: FiscalYearLock[];
  periods: FiscalPeriod[];
}> {
  const [locks, periods] = await Promise.all([
    getFiscalYearLocks().catch((error: unknown) => {
      console.warn(
        "[expense-posting] could not load fiscal year locks; continuing without them",
        error
      );
      return [] as FiscalYearLock[];
    }),
    listFiscalPeriods().catch((error: unknown) => {
      console.warn(
        "[expense-posting] could not load fiscal periods; continuing without them",
        error
      );
      return [] as FiscalPeriod[];
    }),
  ]);
  return { locks, periods };
}

function finalBookedDates(
  lines: ExpenseReceiptLine[],
  shifts: DateShift[]
): Map<string, string> {
  const dates = new Map<string, string>();
  for (const line of lines) {
    if (line.ref && line.date) {
      dates.set(line.ref, line.date);
    }
  }
  // Shifts are in order, so the last one for a ref is where the line landed.
  for (const shift of shifts) {
    if (shift.ref) {
      dates.set(shift.ref, shift.to);
    }
  }
  return dates;
}

function shiftEvents(expenseId: string, shifts: DateShift[]) {
  return shifts.map(
    (shift): ExpenseEventInput => ({
      expenseId,
      actorKind: "system",
      action: "date_shifted",
      attachmentId: shift.ref,
      before: shift.from,
      after: shift.to,
      note: shift.finagoMessage
        ? `${shift.reason}: ${shift.finagoMessage}`
        : shift.reason,
    })
  );
}

async function fetchFileBytes(
  storage: Awaited<ReturnType<typeof createAdminClient>>["storage"],
  fileId: string
): Promise<Uint8Array> {
  const buffer = await storage.getFileDownload(EXPENSES_BUCKET, fileId);
  return new Uint8Array(buffer as ArrayBuffer);
}

async function mergePdf(
  coverBytes: Uint8Array,
  files: { bytes: Uint8Array; contentType: string }[]
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  const cover = await PDFDocument.load(coverBytes);
  const coverPages = await merged.copyPages(cover, cover.getPageIndices());
  for (const page of coverPages) {
    merged.addPage(page);
  }

  for (const file of files) {
    const type = file.contentType.toLowerCase();
    if (type.includes("pdf")) {
      const doc = await PDFDocument.load(file.bytes);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      for (const page of pages) {
        merged.addPage(page);
      }
    } else if (
      type.includes("png") ||
      type.includes("jpg") ||
      type.includes("jpeg")
    ) {
      const image = type.includes("png")
        ? await merged.embedPng(file.bytes)
        : await merged.embedJpg(file.bytes);
      const page = merged.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    } else {
      // Uploads are restricted to PDF/PNG/JPEG, so anything else is a legacy or
      // unexpected file. Fail the merge rather than silently posting a ledger
      // document that's missing supporting receipts; the row is marked failed and
      // surfaced for manual review.
      throw new Error(
        `Unsupported attachment type "${file.contentType}" — cannot embed it in the ledger document.`
      );
    }
  }

  return await merged.save();
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type AdminStorage = Awaited<ReturnType<typeof createAdminClient>>["storage"];

async function recordFailureEvent(
  db: AdminDb,
  expenseId: string,
  error: unknown
): Promise<void> {
  await recordExpenseEvents(db, [
    {
      expenseId,
      actorKind: "system",
      action: "booking_failed",
      note: error instanceof Error ? error.message : String(error),
    },
  ]);
}

async function recordFailure(
  db: AdminDb,
  expenseId: string,
  error: unknown
): Promise<void> {
  await db.updateRow("app", "expense", expenseId, {
    status: ExpensesStatus.FAILED,
  });
  await recordFailureEvent(db, expenseId, error);
}

const SUCCESS_WRITE_EXTRA_ATTEMPTS = 2;
// Waits before the second and third success-write attempts.
const SUCCESS_WRITE_BACKOFF_MS = [500, 2000];

type Sleep = (ms: number) => Promise<void>;

/**
 * Finago accepted the booking, but saving `success` on the expense failed. The
 * expense IS booked, so callers must never present this as "try again".
 */
export class BookingStatusWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingStatusWriteError";
  }
}

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Finago has accepted the transaction, so the only job left is to record that.
// A failed write is retried; if it keeps failing the row stays `posting` (never
// `failed`, never reposted) and the stale-lease reaper surfaces it later.
async function writeSuccess(
  db: AdminDb,
  expenseId: string,
  transactionId: string,
  sleep: Sleep
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= SUCCESS_WRITE_EXTRA_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(SUCCESS_WRITE_BACKOFF_MS[attempt - 1] ?? 0);
    }
    try {
      await db.updateRow("app", "expense", expenseId, {
        ledger_transaction_id: transactionId,
        status: ExpensesStatus.SUCCESS,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }
  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  console.error(
    `[expense-posting] expense ${expenseId} was booked as transaction ${transactionId} but the status write failed:`,
    lastError
  );
  await recordExpenseEvents(db, [
    {
      expenseId,
      actorKind: "system",
      action: "booked",
      note: `${transactionId} (status write failed: ${message})`,
    },
  ]);
  throw new BookingStatusWriteError(message);
}

// Bookkeeping after a successful post. Failures here only log: the money is
// already posted and the expense is already marked `success`.
async function recordBooking(
  db: AdminDb,
  expenseId: string,
  booking: {
    lines: ExpenseReceiptLine[];
    shifts: DateShift[];
    transactionId: string;
  }
): Promise<void> {
  for (const [ref, bookedDate] of finalBookedDates(
    booking.lines,
    booking.shifts
  )) {
    try {
      await db.updateRow("app", "expense_attachments", ref, {
        booked_date: bookedDate,
      });
    } catch (error) {
      console.error(
        `[expense-posting] could not save booked date for ${ref} on ${expenseId}:`,
        error
      );
    }
  }
  await recordExpenseEvents(db, [
    ...shiftEvents(expenseId, booking.shifts),
    {
      expenseId,
      actorKind: "system",
      action: "booked",
      note: booking.transactionId,
    },
  ]);
}

function exampleSource(
  accountSource: ExpenseAttachments["account_source"]
): BookedExampleInput["source"] {
  if (accountSource === "approver" || accountSource === "admin") {
    return accountSource;
  }
  return "student";
}

/**
 * Whether a booked receipt may teach later classifications. An old app sends
 * its default type unasked, so its type counts only when the AI was sure of
 * the same one.
 */
function teachesType(att: ExpenseAttachments): boolean {
  if (att.type_source !== "legacy_app") {
    return true;
  }
  return (
    !!att.cost_type &&
    att.ai_cost_type === att.cost_type &&
    (att.ai_confidence ?? 0) >= AI_TYPE_CONFIDENCE_THRESHOLD
  );
}

// One anonymous example per posted receipt, so later classifications learn from
// what actually got booked. Never stores a submitter, name or expense id, and
// never the student's own description: examples go into other students' prompts.
async function writeBookedExamples(
  db: AdminDb,
  attachments: ExpenseAttachments[],
  lines: ExpenseReceiptLine[]
): Promise<void> {
  const rows: BookedExampleInput[] = [];
  for (const line of lines) {
    const att = attachments.find((a) => a.$id === line.ref);
    if (!(att?.file_hash && teachesType(att))) {
      continue;
    }
    const scan = await findScan(db, att.file_hash);
    rows.push({
      accountNumber: Number(line.accountNumber),
      aiConfidence: att.ai_confidence ?? null,
      aiCostType: att.ai_cost_type ?? null,
      amount: line.amount,
      description: scan?.receipt.description ?? "",
      finalCostType: att.cost_type || null,
      finalText: att.cost_type_text ?? null,
      source: exampleSource(att.account_source),
      vendor: scan?.receipt.vendor ?? null,
    });
  }
  await writeExamples(db, rows);
}

async function writeBookedExamplesSafely(
  db: AdminDb,
  expenseId: string,
  attachments: ExpenseAttachments[],
  lines: ExpenseReceiptLine[]
): Promise<void> {
  try {
    await writeBookedExamples(db, attachments, lines);
  } catch (error) {
    console.error(
      `[expense-posting] could not write examples for ${expenseId}:`,
      error
    );
  }
}

/**
 * Whether a stored claim or transaction id means this run must not post.
 * Throws for a stale claim, after marking the expense failed.
 */
async function shouldSkipClaimedExpense(
  db: AdminDb,
  expense: {
    $id: string;
    $updatedAt: string;
    ledger_transaction_id?: string | null;
  }
): Promise<boolean> {
  const expenseId = expense.$id;
  if (!expense.ledger_transaction_id) {
    return false;
  }
  if (expense.ledger_transaction_id !== POSTING_CLAIM_MARKER) {
    return true; // a real 24SO transaction id — already posted.
  }
  // A "posting" marker means a run claimed this row. While the claim is fresh,
  // another run is actively posting, so skip. Once it's older than the lease, the
  // claiming run crashed or timed out: surface the row as failed for manual review
  // rather than leaving it stuck `approved` forever (and counted as posted) — we
  // must NOT auto-repost, because the dead run may already have reached 24SO.
  const claimAgeMs = Date.now() - new Date(expense.$updatedAt).getTime();
  if (claimAgeMs < STALE_POSTING_LEASE_MS) {
    return true;
  }
  await db.updateRow("app", "expense", expenseId, {
    status: ExpensesStatus.FAILED,
  });
  const staleError = new Error(
    `Stale posting claim on expense ${expenseId} (${Math.round(
      claimAgeMs / 1000
    )}s old) — marked failed for manual review.`
  );
  await recordFailureEvent(db, expenseId, staleError);
  throw staleError;
}

const POSTING_SELECT = [
  "$id",
  "$updatedAt",
  "campus",
  "department",
  "bank_account",
  "total",
  "description",
  "userId",
  "status",
  "ledger_transaction_id",
  "posting_lock",
  "$sequence",
  "departmentRel.Id",
  "departmentRel.Name",
  "campusRel.name",
  "expenseAttachments.*",
];

export function loadExpenseForPosting(
  db: AdminDb,
  expenseId: string
): Promise<ExpenseWithRels> {
  return db.getRow<ExpenseWithRels>("app", "expense", expenseId, [
    Query.select(POSTING_SELECT),
  ]);
}

export interface LedgerPosting {
  /** Date shifts made while building the lines (missing, future or locked-year dates). */
  builtShifts: DateShift[];
  posted: PostedExpenseTransaction;
  receipts: ExpenseReceiptLine[];
}

/**
 * Builds an expense's ledger lines and document and posts the transaction to
 * Finago. Reads Appwrite (profile, cost types, receipt files) but writes
 * nothing to it, so `scripts/post-expense-to-demo.ts` can run the real booking
 * against the DEMO company.
 */
export async function buildAndPostLedgerTransaction(
  db: AdminDb,
  storage: AdminStorage,
  expense: ExpenseWithRels
): Promise<LedgerPosting> {
  // One Oslo "today" per posting: used for date resolution, the closed-period
  // retry limit and the voucher header date.
  const today = todayInOslo();
  const profile = await db.getRow<Users>("app", "user", expense.userId);
  const options = await loadAllCostTypes(db);
  const ordered = sortedAttachments(expense.expenseAttachments ?? []);
  const { locks, periods } = await loadFiscalContext();
  const built = buildReceiptLines(ordered, options, {
    locks,
    periods,
    today,
  });
  const receipts = built.lines;

  if (receipts.length === 0) {
    throw new Error("No receipt lines with a positive amount to post");
  }

  const refNumber = reimbursementNumber(expense.$sequence);
  const addressParts = [profile.address, profile.zip, profile.city].filter(
    Boolean
  );

  const coverBytes = await generateExpensePdf({
    reimbursementNumber: refNumber,
    name: profile.name ?? "",
    address: addressParts.join(", ") || "Ikke oppgitt",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    bankAccount: expense.bank_account,
    invoiceDate: formatDate(new Date()),
    campusAndUnit: `${expense.departmentRel?.Name ?? expense.department} - ${expense.campusRel?.name ?? expense.campus}`,
    purpose: expense.description ?? "",
    attachments: ordered.map((att) => ({
      description: att.description ?? "",
      date: att.date ? formatDate(new Date(att.date)) : "",
      amount: att.amount ?? 0,
    })),
    subtotal: expense.total,
    total: expense.total,
  });

  const files = await Promise.all(
    ordered
      .filter((att) => att.url)
      .map(async (att) => ({
        bytes: await fetchFileBytes(storage, att.url as string),
        contentType: att.type,
      }))
  );

  const mergedBytes = await mergePdf(new Uint8Array(coverBytes), files);
  const { documentId } = await uploadDocument(mergedBytes, "application/pdf");

  const posted = await postExpenseTransaction({
    date: today,
    comment: `Refusjon ${refNumber}`,
    documentId,
    bankAccount: expense.bank_account,
    invoiceNumber: refNumber,
    receipts,
    campusId: expense.campus,
    departmentDimensionValue: expense.departmentRel?.Id ?? null,
    periods,
    today,
  });
  return { builtShifts: built.shifts, posted, receipts };
}

/**
 * Everything after a posting claim has been taken: builds the ledger document,
 * posts it, saves the result and the booking history. The caller owns the claim
 * (a `posting_lock` it won and a fresh `posting` marker on the row).
 */
async function postClaimedExpense(
  db: AdminDb,
  storage: AdminStorage,
  expense: ExpenseWithRels,
  sleep: Sleep
): Promise<void> {
  const expenseId = expense.$id;
  let ledger: LedgerPosting;
  try {
    ledger = await buildAndPostLedgerTransaction(db, storage, expense);
  } catch (error) {
    console.error(`[expense-posting] failed for ${expenseId}:`, error);
    // Keep the claim in place (both `posting_lock` and the marker on
    // `ledger_transaction_id`): the transaction may have reached 24SO before the
    // failure, so the row must not be re-posted automatically. A failed row is
    // surfaced for manual review/retry instead.
    await recordFailure(db, expenseId, error);
    throw error;
  }
  const { builtShifts, posted, receipts } = ledger;

  // Finago has the transaction. From here on nothing may mark the row failed.
  await writeSuccess(db, expenseId, posted.transactionId, sleep);

  await recordBooking(db, expenseId, {
    lines: receipts,
    shifts: [...builtShifts, ...posted.shifts],
    transactionId: posted.transactionId,
  });

  await writeBookedExamplesSafely(
    db,
    expenseId,
    expense.expenseAttachments ?? [],
    receipts
  );
}

/**
 * Posts a single approved expense to the ledger. Sets status to `success` on
 * success (storing the 24SO transaction id) or `failed` on error. Idempotent
 * and concurrency-safe: atomically claims the row via the `posting_lock` counter
 * before any 24SO call, so an already-posted/claimed expense is skipped even when
 * two dispatch runs overlap.
 */
export async function postApprovedExpense(
  expenseId: string,
  options: { sleep?: Sleep } = {}
): Promise<void> {
  const sleep = options.sleep ?? defaultSleep;
  const { db, storage } = await createAdminClient();

  const expense = await loadExpenseForPosting(db, expenseId);

  // A stale listing may name an expense that has moved on (retried, booked,
  // failed): only an approved expense is claimed.
  if (expense.status !== ExpensesStatus.APPROVED) {
    return;
  }
  if (await shouldSkipClaimedExpense(db, expense)) {
    return;
  }

  try {
    await assertApprovedExpenseChain(db, expenseId);
  } catch (error) {
    await db.updateRow("app", "expense", expenseId, {
      status: ExpensesStatus.FAILED,
    });
    await recordFailureEvent(db, expenseId, error);
    throw error;
  }

  // Atomically claim the row before any 24SO work. `incrementRowColumn` is a
  // server-side atomic read-modify-write, so two overlapping dispatch runs are
  // serialized rather than racing on a read-then-write: the first claimer takes
  // `posting_lock` 0 → 1, the next 1 → 2, and so on. Only the run that observes
  // exactly 1 owns the claim; any other value means another run already owns it.
  // We intentionally do NOT pass a `max` bound: the claim is decided by the
  // returned value, so a lost race is a normal `!== 1` return and any thrown error
  // is a real failure (e.g. the column isn't deployed, permissions, an Appwrite
  // outage) that must surface so the scheduler reports the run as failed.
  const claimed = await db.incrementRowColumn<Expenses>({
    databaseId: "app",
    tableId: "expense",
    rowId: expenseId,
    column: "posting_lock",
    value: 1,
  });
  if ((claimed.posting_lock ?? 0) !== 1) {
    return; // lost the race — another run claimed first
  }

  // Mark the slow phase on `ledger_transaction_id` too, so the cheap early check
  // above still short-circuits any re-entrant or legacy run.
  await db.updateRow("app", "expense", expenseId, {
    ledger_transaction_id: POSTING_CLAIM_MARKER,
  });

  await postClaimedExpense(db, storage, expense, sleep);
}

export type RetryErrorCode =
  | "already_booked"
  | "not_failed"
  | "retry_in_progress"
  | "booking_failed"
  | "status_write_failed";

type RetryResult =
  | { ok: true; status: string }
  | { ok: false; error: string; code: RetryErrorCode };

const NOTE_TRANSACTION_ID = /^\S+/;

/** The transaction id of an earlier `booked` event, or null when there is none. */
async function bookedTransactionId(
  db: AdminDb,
  expenseId: string
): Promise<string | null> {
  const { rows } = await db.listRows<ExpenseEvents>("app", "expense_events", [
    Query.equal("expense_id", expenseId),
    Query.equal("action", "booked"),
    Query.limit(1),
  ]);
  const event = rows[0];
  if (!event) {
    return null;
  }
  return event.note?.match(NOTE_TRANSACTION_ID)?.[0] ?? "an earlier booking";
}

/**
 * Re-runs the booking of a failed expense, after a person has checked Finago.
 * Refuses when the expense is not failed, has a stored transaction id, or has a
 * `booked` history event (Finago already has it, e.g. after a failed status
 * write that the stale-lease reaper later turned `failed`). Overlapping retries
 * are serialized by an atomic `posting_lock` increment: only the one that takes
 * the next value while the row is still `failed` goes on. The lock is never
 * reset, and the fresh `posting` marker keeps the scheduled run away; a crash is
 * reaped after the lease like any other claim.
 */
export async function retryExpenseBooking(params: {
  expenseId: string;
  actor: ApprovalActor;
}): Promise<RetryResult> {
  const { db, storage } = await createAdminClient();
  const { expenseId, actor } = params;
  const expense = await loadExpenseForPosting(db, expenseId);
  if (expense.status !== ExpensesStatus.FAILED) {
    return {
      ok: false,
      code: "not_failed",
      error: "Only failed bookings can be retried.",
    };
  }
  const stored = expense.ledger_transaction_id;
  if (stored && stored !== POSTING_CLAIM_MARKER) {
    return {
      ok: false,
      code: "already_booked",
      error: `Already booked as ${stored}.`,
    };
  }
  const booked = await bookedTransactionId(db, expenseId);
  if (booked) {
    return {
      ok: false,
      code: "already_booked",
      error: `Already booked as ${booked}.`,
    };
  }
  try {
    await assertApprovedExpenseChain(db, expenseId);
  } catch (error) {
    return {
      ok: false,
      code: "booking_failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const readLock = expense.posting_lock ?? 0;
  const claimed = await db.incrementRowColumn<Expenses>({
    databaseId: "app",
    tableId: "expense",
    rowId: expenseId,
    column: "posting_lock",
    value: 1,
  });
  if (
    (claimed.posting_lock ?? 0) !== readLock + 1 ||
    claimed.status !== ExpensesStatus.FAILED
  ) {
    return {
      ok: false,
      code: "retry_in_progress",
      error: "This booking is already being retried.",
    };
  }

  await db.updateRow("app", "expense", expenseId, {
    status: ExpensesStatus.APPROVED,
    ledger_transaction_id: POSTING_CLAIM_MARKER,
  });
  // Another retry may have incremented between our claim and this write, while
  // the row still read `failed`. Only the one whose value is still the latest
  // posts; the other leaves the row approved with a fresh marker (the cron skips
  // it, and the stale-lease reaper turns it `failed` if nobody posts).
  const current = await db.getRow<Expenses>("app", "expense", expenseId, [
    Query.select(["$id", "posting_lock"]),
  ]);
  if ((current.posting_lock ?? 0) !== claimed.posting_lock) {
    return {
      ok: false,
      code: "retry_in_progress",
      error: "This booking is already being retried.",
    };
  }
  await recordExpenseEvents(db, [
    {
      expenseId,
      actorKind: actor.kind,
      actorEmail: actor.email,
      actorName: actor.name,
      action: "booking_retried",
      note: "retried from admin",
    },
  ]);

  try {
    await postClaimedExpense(db, storage, expense, defaultSleep);
  } catch (error) {
    return {
      ok: false,
      code:
        error instanceof BookingStatusWriteError
          ? "status_write_failed"
          : "booking_failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
  const after = await db.getRow<Expenses>("app", "expense", expenseId, [
    Query.select(["$id", "status"]),
  ]);
  return { ok: true, status: after.status };
}
