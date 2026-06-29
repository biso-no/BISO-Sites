// Posts an approved reimbursement to the 24SevenOffice ledger: builds one merged
// PDF (invoice cover first, then receipts/bank statements in their saved order),
// uploads it, then posts the balanced transaction. Files are kept in storage.

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  ExpenseAttachments,
  ExpenseCostTypes,
  Expenses,
  Users,
} from "@repo/api/types/appwrite";
import { ExpensesStatus } from "@repo/api/types/appwrite";
import {
  type ExpenseReceiptLine,
  postExpenseTransaction,
  uploadDocument,
} from "@repo/connectors/24sevenoffice";
import {
  type CostTypeOption,
  resolveReceiptAccount,
} from "@repo/shared/utils/expense-cost-types";
import { PDFDocument } from "pdf-lib";
import { generateExpensePdf } from "./pdf/expense-pdf";

const EXPENSES_BUCKET = "expenses";

// Sentinel written to `ledger_transaction_id` once an expense has been atomically
// claimed (via the `posting_lock` counter) and is in the slow upload/post phase.
// It is overwritten with the real transaction id on success and left in place on
// failure so a failed row is never silently re-posted.
const POSTING_CLAIM_MARKER = "posting";

type ExpenseWithRels = Expenses & {
  departmentRel: { Id?: string; Name?: string } | null;
  campusRel: { name?: string } | null;
};

function reimbursementNumber(sequence: number | string): string {
  return String(10_000 + Number(sequence || 0)).padStart(5, "0");
}

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

async function loadCostTypeOptions(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"]
): Promise<CostTypeOption[]> {
  const rows = await db.listRows<ExpenseCostTypes>(
    "app",
    "expense_cost_types",
    [Query.limit(100)]
  );
  return rows.rows.map((row) => ({
    slug: row.slug,
    label: row.label,
    accountNumber: row.account_number,
    taxCode: row.tax_code,
    ocrCategory: row.ocr_category,
  }));
}

function buildReceiptLines(
  attachments: ExpenseAttachments[],
  options: CostTypeOption[]
): ExpenseReceiptLine[] {
  const lines: ExpenseReceiptLine[] = [];
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
      });
      continue;
    }
    const resolved = resolveReceiptAccount(att.cost_type, options);
    lines.push({
      accountNumber: resolved.accountNumber,
      amount,
      taxCode: resolved.taxCode,
      comment: att.description ?? undefined,
    });
  }
  return lines;
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
    }
    // Other types (e.g. webp) are skipped — they stay viewable in storage.
  }

  return await merged.save();
}

/**
 * Posts a single approved expense to the ledger. Sets status to `success` on
 * success (storing the 24SO transaction id) or `failed` on error. Idempotent
 * and concurrency-safe: atomically claims the row via the `posting_lock` counter
 * before any 24SO call, so an already-posted/claimed expense is skipped even when
 * two dispatch runs overlap.
 */
export async function postApprovedExpense(expenseId: string): Promise<void> {
  const { db, storage } = await createAdminClient();

  const expense = await db.getRow<ExpenseWithRels>(
    "app",
    "expense",
    expenseId,
    [
      Query.select([
        "$id",
        "campus",
        "department",
        "bank_account",
        "total",
        "description",
        "userId",
        "status",
        "ledger_transaction_id",
        "$sequence",
        "departmentRel.Id",
        "departmentRel.Name",
        "campusRel.name",
        "expenseAttachments.*",
      ]),
    ]
  );

  if (expense.ledger_transaction_id) {
    return; // already posted or claimed by a concurrent run
  }

  // Atomically claim the row before any 24SO work. `incrementRowColumn` is a
  // server-side atomic read-modify-write, so two overlapping dispatch runs are
  // serialized rather than racing on a read-then-write: the first claimer takes
  // `posting_lock` 0 → 1, the next 1 → 2 (or is rejected by `max`). Only the run
  // that observes exactly 1 owns the claim; any other value — or a thrown
  // max-bound error — means another run already owns it, so we bail.
  let claimedLock: number;
  try {
    const claimed = await db.incrementRowColumn<Expenses>({
      databaseId: "app",
      tableId: "expense",
      rowId: expenseId,
      column: "posting_lock",
      value: 1,
      max: 1,
    });
    claimedLock = claimed.posting_lock ?? 0;
  } catch {
    return; // lost the race — another run already claimed (hit the max bound)
  }
  if (claimedLock !== 1) {
    return; // lost the race — another run claimed first
  }

  // Mark the slow phase on `ledger_transaction_id` too, so the cheap early check
  // above still short-circuits any re-entrant or legacy run.
  await db.updateRow("app", "expense", expenseId, {
    ledger_transaction_id: POSTING_CLAIM_MARKER,
  });

  try {
    const profile = await db.getRow<Users>("app", "user", expense.userId);
    const options = await loadCostTypeOptions(db);
    const ordered = sortedAttachments(expense.expenseAttachments ?? []);
    const receipts = buildReceiptLines(ordered, options);

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

    const transactionId = await postExpenseTransaction({
      date: new Date().toISOString().split("T")[0],
      comment: `Refusjon ${refNumber}`,
      documentId,
      bankAccount: expense.bank_account,
      invoiceNumber: refNumber,
      receipts,
      campusId: expense.campus,
      departmentDimensionValue: expense.departmentRel?.Id ?? null,
    });

    await db.updateRow("app", "expense", expenseId, {
      ledger_transaction_id: transactionId,
      status: ExpensesStatus.SUCCESS,
    });
  } catch (error) {
    console.error(`[expense-posting] failed for ${expenseId}:`, error);
    // Keep the claim in place (both `posting_lock` and the marker on
    // `ledger_transaction_id`): the transaction may have reached 24SO before the
    // failure, so the row must not be re-posted automatically. A failed row is
    // surfaced for manual review/retry instead.
    await db.updateRow("app", "expense", expenseId, {
      status: ExpensesStatus.FAILED,
    });
    throw error;
  }
}
