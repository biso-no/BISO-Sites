import "server-only";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type ExpenseAttachments,
  ExpenseAttachmentsProjectSource,
  type ExpenseCostTypes,
  type ExpenseEvents,
  type Expenses,
  ExpensesStatus,
} from "@repo/api/types/appwrite";
import { redirect } from "next/navigation";
import { getUserAuthContext } from "@/lib/authorization";
import { ROLES } from "@/lib/roles";
import {
  AI_EVAL_WINDOW_DAYS,
  type EvalRow,
  type ProjectPickRow,
} from "./ai-model";

const MS_PER_DAY = 86_400_000;
const PAGE_SIZE = 500;
/** Most receipts read per list; the page says so when this is hit. */
export const AI_EVAL_ROW_CAP = 5000;
/** Appwrite's limit for `Query.equal` values. */
const ID_CHUNK = 100;
const TYPES_LIMIT = 500;

export interface AiEvalData {
  /** True when a read stopped at the cap, so older receipts are missing. */
  capped: boolean;
  /** Every non-draft receipt with an own text, AI pick or not. */
  ownTextRows: Pick<EvalRow, "costTypeText">[];
  /** One per reviewed receipt where the check set a project; null when that read failed. */
  projectRows: ProjectPickRow[] | null;
  /** Non-draft receipts with an AI pick. */
  rows: EvalRow[];
  typeLabels: { label: string; labelNo: string | null; slug: string }[];
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function requireGlobalAdmin(): Promise<void> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (!ctx.roles.includes(ROLES.GLOBAL_ADMIN)) {
    throw new Error("Forbidden: only global admins can see the AI results");
  }
}

/**
 * The latest attachments matching `queries`, newest first, up to the cap. One
 * row past the cap is read, so `capped` is true only when more rows exist.
 */
async function readAttachments(
  db: AdminDb,
  queries: string[]
): Promise<{ capped: boolean; rows: ExpenseAttachments[] }> {
  const rows: ExpenseAttachments[] = [];
  while (rows.length <= AI_EVAL_ROW_CAP) {
    const limit = Math.min(PAGE_SIZE, AI_EVAL_ROW_CAP + 1 - rows.length);
    const page = await db.listRows<ExpenseAttachments>(
      "app",
      "expense_attachments",
      [
        ...queries,
        Query.orderDesc("$createdAt"),
        Query.limit(limit),
        Query.offset(rows.length),
      ]
    );
    rows.push(...page.rows);
    if (page.rows.length < limit) {
      return { capped: false, rows };
    }
  }
  return { capped: true, rows: rows.slice(0, AI_EVAL_ROW_CAP) };
}

/**
 * `expense_id` is a plain column, not a relationship the attachments can be
 * filtered through, so the parents' status is read in chunks of ids.
 */
async function readDraftExpenseIds(
  db: AdminDb,
  expenseIds: string[]
): Promise<Set<string>> {
  const drafts = new Set<string>();
  for (let i = 0; i < expenseIds.length; i += ID_CHUNK) {
    const chunk = expenseIds.slice(i, i + ID_CHUNK);
    const page = await db.listRows<Expenses>("app", "expense", [
      Query.equal("$id", chunk),
      Query.equal("status", ExpensesStatus.DRAFT),
      Query.select(["$id"]),
      Query.limit(ID_CHUNK),
    ]);
    for (const row of page.rows) {
      drafts.add(row.$id);
    }
  }
  return drafts;
}

/** Parent statuses that mean an approver has been through the receipt. */
const REVIEWED_STATUSES: string[] = [
  ExpensesStatus.APPROVED,
  ExpensesStatus.SUBMITTED,
  ExpensesStatus.SUCCESS,
];

/** The AI check's project changes, newest first; one row past the cap is read. */
async function readProjectEvents(
  db: AdminDb,
  since: string
): Promise<{ capped: boolean; events: ExpenseEvents[] }> {
  const events: ExpenseEvents[] = [];
  while (events.length <= AI_EVAL_ROW_CAP) {
    const limit = Math.min(PAGE_SIZE, AI_EVAL_ROW_CAP + 1 - events.length);
    const page = await db.listRows<ExpenseEvents>("app", "expense_events", [
      Query.equal("action", "edited"),
      Query.equal("field", "project"),
      Query.equal("actor_kind", "ai"),
      Query.greaterThanEqual("$createdAt", since),
      Query.select(["attachment_id", "$createdAt"]),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      Query.offset(events.length),
    ]);
    events.push(...page.rows);
    if (page.rows.length < limit) {
      return { capped: false, events };
    }
  }
  return { capped: true, events: events.slice(0, AI_EVAL_ROW_CAP) };
}

/** Ids of the expenses, among `expenseIds`, an approver has been through. */
async function readReviewedExpenseIds(
  db: AdminDb,
  expenseIds: string[]
): Promise<Set<string>> {
  const reviewed = new Set<string>();
  for (let i = 0; i < expenseIds.length; i += ID_CHUNK) {
    const chunk = expenseIds.slice(i, i + ID_CHUNK);
    const page = await db.listRows<Expenses>("app", "expense", [
      Query.equal("$id", chunk),
      Query.select(["$id", "status"]),
      Query.limit(ID_CHUNK),
    ]);
    for (const row of page.rows) {
      if (REVIEWED_STATUSES.includes(row.status)) {
        reviewed.add(row.$id);
      }
    }
  }
  return reviewed;
}

/**
 * Receipts where the background check set a project, from its history rows,
 * and whether each project is still the check's: a later approver or admin
 * edit changes `project_source`. Only receipts whose expense an approver has
 * been through count; a receipt that is gone or has no source is skipped.
 */
async function readProjectPicks(
  db: AdminDb,
  since: string
): Promise<{ capped: boolean; rows: ProjectPickRow[] }> {
  const { capped, events } = await readProjectEvents(db, since);
  // The latest change of a receipt's project is the one that counts.
  const latest = new Map<string, string>();
  for (const event of events) {
    if (event.attachment_id && !latest.has(event.attachment_id)) {
      latest.set(event.attachment_id, event.$createdAt);
    }
  }
  const ids = [...latest.keys()];
  const receipts = new Map<
    string,
    { expenseId: string | null; source: string }
  >();
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const page = await db.listRows<ExpenseAttachments>(
      "app",
      "expense_attachments",
      [
        Query.equal("$id", chunk),
        Query.select(["$id", "expense_id", "project_source"]),
        Query.limit(ID_CHUNK),
      ]
    );
    for (const row of page.rows) {
      if (row.project_source) {
        receipts.set(row.$id, {
          expenseId: row.expense_id,
          source: row.project_source,
        });
      }
    }
  }
  const reviewed = await readReviewedExpenseIds(db, [
    ...new Set(
      [...receipts.values()].flatMap((r) => (r.expenseId ? [r.expenseId] : []))
    ),
  ]);
  const rows: ProjectPickRow[] = [];
  for (const [id, receipt] of receipts) {
    if (receipt.expenseId && reviewed.has(receipt.expenseId)) {
      rows.push({
        createdAt: latest.get(id) as string,
        kept: receipt.source === ExpenseAttachmentsProjectSource.AI_CHECK,
      });
    }
  }
  return { capped, rows };
}

export async function loadAiEvalData(): Promise<AiEvalData> {
  await requireGlobalAdmin();
  const { db } = await createAdminClient();
  const since = new Date(
    Date.now() - AI_EVAL_WINDOW_DAYS * MS_PER_DAY
  ).toISOString();

  // The own texts are read on their own: a student who typed one may have
  // had no AI pick at all.
  const [picks, ownTexts, types, projectPicks] = await Promise.all([
    readAttachments(db, [
      Query.isNotNull("ai_cost_type"),
      Query.greaterThanEqual("$createdAt", since),
      Query.select([
        "ai_cost_type",
        "ai_confidence",
        "cost_type",
        "cost_type_text",
        "expense_id",
        "$createdAt",
      ]),
    ]),
    readAttachments(db, [
      Query.isNotNull("cost_type_text"),
      Query.greaterThanEqual("$createdAt", since),
      Query.select(["cost_type_text", "expense_id", "$createdAt"]),
    ]),
    db.listRows<ExpenseCostTypes>("app", "expense_cost_types", [
      Query.select(["slug", "label", "label_no"]),
      Query.limit(TYPES_LIMIT),
    ]),
    readProjectPicks(db, since).catch((error: unknown) => {
      // The project rate is a side figure; the type stats must still show.
      console.error("[expense-ai] Project kept-rate read failed:", error);
      return null;
    }),
  ]);

  const expenseIds = [
    ...new Set(
      [...picks.rows, ...ownTexts.rows].flatMap((row) =>
        row.expense_id ? [row.expense_id] : []
      )
    ),
  ];
  const drafts = await readDraftExpenseIds(db, expenseIds);
  const notDraft = (row: ExpenseAttachments) =>
    !(row.expense_id && drafts.has(row.expense_id));

  return {
    capped: picks.capped || ownTexts.capped || !!projectPicks?.capped,
    ownTextRows: ownTexts.rows
      .filter(notDraft)
      .map((row) => ({ costTypeText: row.cost_type_text })),
    projectRows: projectPicks?.rows ?? null,
    rows: picks.rows.filter(notDraft).map((row) => ({
      aiConfidence: row.ai_confidence,
      aiCostType: row.ai_cost_type,
      costType: row.cost_type,
      costTypeText: row.cost_type_text,
      createdAt: row.$createdAt,
    })),
    typeLabels: types.rows.map((row) => ({
      label: row.label,
      labelNo: row.label_no ?? null,
      slug: row.slug,
    })),
  };
}
