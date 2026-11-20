// Applies the background check's answer. The agent only proposes: here every
// type, account and project is checked against the live lists, a student's
// explicit type is never changed, and every change and flag goes to the
// history (actor: the AI check) and the approver hints. Anything invalid is
// dropped and flagged, never stored.

import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import {
  type Departments,
  type ExpenseAttachments,
  ExpenseAttachmentsAccountSource,
  ExpenseAttachmentsProjectSource,
  ExpenseAttachmentsTypeSource,
  type Expenses,
  type FinagoProjects,
  type FinagoProjectUsage,
  type LedgerAccounts,
} from "@repo/api/types/appwrite";
import {
  AI_TYPE_CONFIDENCE_THRESHOLD,
  type CostTypeOption,
} from "@repo/shared/utils/expense-cost-types";
import {
  type ExpenseEventInput,
  recordExpenseEvents,
} from "@repo/shared/utils/expense-events";
import {
  type ApproverHint,
  type ApproverHintCode,
  MAX_HINT_TEXT_CHARS,
  parseApproverHints,
} from "@repo/shared/utils/expense-hints";
import {
  departmentCandidates,
  editionTiming,
  type ProjectShareClass,
  parseProjectName,
  type SeriesTiming,
  seriesOf,
  shareClass,
} from "@repo/shared/utils/finago-projects";
import { hintsJson } from "../expense-submission";
import { activeCostTypes, loadAllCostTypes } from "../expense-types";
import { receiptDateInOslo } from "../receipt-date";
import type { CheckAnswer, CheckFlag, ReceiptAnswer } from "./agent";
import { departmentEvents, type SiteEvent, websiteDates } from "./tools";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];
type Row = ExpenseAttachments;

/** How the check signs its history events. */
const CHECK_ACTOR = "AI check";
const FIRST_COST_ACCOUNT = 4000;
const END_COST_ACCOUNT = 8000;
const PROJECT_FETCH_LIMIT = 5000;
const USAGE_FETCH_LIMIT = 500;
const ACCOUNT_FETCH_LIMIT = 100;
const MAX_NOTE_CHARS = 500;
/** How much of a value the model made up is quoted back in a flag. */
const MAX_QUOTED_CHARS = 60;
const WHITESPACE_RUN = /\s+/g;
const FOUR_DIGIT_YEARS = /(?<!\d)(?:19|20)\d{2}(?!\d)/g;
const TRAILING_TWO_DIGITS = /\s\d{2}$/;
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/** Types a person chose: the check never changes them. */
const CHOSEN_TYPE_SOURCES = new Set<Row["type_source"]>([
  ExpenseAttachmentsTypeSource.STUDENT,
  ExpenseAttachmentsTypeSource.APPROVER,
  ExpenseAttachmentsTypeSource.ADMIN,
]);
/** Accounts or projects a person set: the check leaves them. */
const PERSON_SOURCES = new Set<string | null>(["approver", "admin"]);
/** The hints a type the check sets makes stale for that receipt. */
const TYPE_DECISION_HINTS: ApproverHintCode[] = [
  "type_defaulted",
  "account_missing",
  "app_type_replaced",
  "ai_account_unsure",
];
/** The hints an own-text account the check sets makes stale. */
const ACCOUNT_DECISION_HINTS: ApproverHintCode[] = [
  "account_missing",
  "ai_account_unsure",
];
const PROJECT_HINTS = new Set<ApproverHintCode>([
  "project_missing",
  "project_not_created",
  "project_unsure",
]);

export type CheckedExpense = Pick<
  Expenses,
  "$id" | "approver_hints" | "department" | "expenseAttachments"
>;

export interface ApplyContext {
  /** Today in Oslo, `YYYY-MM-DD`. */
  today: string;
}

export interface AppliedChange {
  after: string | number;
  before: string | number | null;
  field: "account_number" | "cost_type" | "project";
  receiptId: string;
}

interface Lists {
  /** Active cost accounts the answer named, by number. */
  accounts: Map<number, { taxCode: number }>;
  /** The department's active candidate projects, by project id. */
  candidates: Map<string, FinagoProjects>;
  /** Every project, closed ones too (they place the editions in time). */
  projects: FinagoProjects[];
  shareClass: ProjectShareClass | "unknown";
  siteEvents: SiteEvent[];
  /** Active types, by slug. */
  types: Map<string, CostTypeOption>;
}

interface Work {
  changes: AppliedChange[];
  events: ExpenseEventInput[];
  expenseId: string;
  /** New hints from this check, in the order they were found. */
  hints: ApproverHint[];
  patches: Map<string, Record<string, unknown>>;
  /** Receipts that now have a project. */
  projectSet: Set<string>;
  /** The check's reason per receipt, quoted when its pick is refused. */
  reasons: Map<string, string>;
  /** Stored hints this check made stale, by receipt. */
  stale: Map<string, Set<ApproverHintCode>>;
}

/** One line, at most `max` characters, ending in an ellipsis when cut. */
function oneLine(value: string, max: number): string {
  const text = value.replace(WHITESPACE_RUN, " ").trim();
  const chars = Array.from(text);
  return chars.length > max
    ? `${chars
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`
    : text;
}

const hintText = (value: string) => oneLine(value, MAX_HINT_TEXT_CHARS);
const quoted = (value: string) => oneLine(value, MAX_QUOTED_CHARS);

function confidenceOf(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0;
}

function noteOf(confidence: number, reason: string): string {
  return oneLine(
    `Confidence ${confidence.toFixed(2)}: ${reason}`,
    MAX_NOTE_CHARS
  );
}

const isReceipt = (row: Row) => (row.amount ?? 0) > 0;
const isOwnText = (row: Row) => Boolean(row.cost_type_text?.trim());

function patch(work: Work, row: Row, data: Record<string, unknown>): void {
  work.patches.set(row.$id, { ...work.patches.get(row.$id), ...data });
}

function markStale(work: Work, row: Row, codes: ApproverHintCode[]): void {
  const stale = work.stale.get(row.$id) ?? new Set<ApproverHintCode>();
  for (const code of codes) {
    stale.add(code);
  }
  work.stale.set(row.$id, stale);
}

function sameHint(a: ApproverHint, b: ApproverHint): boolean {
  return a.code === b.code && a.attachmentId === b.attachmentId;
}

function addHint(work: Work, hint: ApproverHint): boolean {
  if (work.hints.some((other) => sameHint(other, hint))) {
    return false;
  }
  work.hints.push(hint);
  return true;
}

/** What a flag's history line shows as its value. */
function flagValue(hint: ApproverHint): string | null {
  if (hint.code === "ai_check_disagrees") {
    return String(hint.data?.aiType ?? "");
  }
  if (hint.code === "project_not_created") {
    return `${hint.data?.series ?? ""} ${hint.data?.year ?? ""}`.trim();
  }
  return null;
}

/** A hint for the approver and the same flag in the history. */
function flag(work: Work, hint: ApproverHint, note?: string): void {
  if (!addHint(work, hint)) {
    return;
  }
  work.events.push({
    action: "ai_flagged",
    actorKind: "ai",
    actorName: CHECK_ACTOR,
    after: flagValue(hint),
    attachmentId: hint.attachmentId ?? null,
    expenseId: work.expenseId,
    field: hint.code,
    note: oneLine(note ?? String(hint.data?.reason ?? ""), MAX_NOTE_CHARS),
  });
}

// --- Loading the lists ------------------------------------------------------

async function loadAccounts(
  db: Db,
  numbers: number[]
): Promise<Lists["accounts"]> {
  const accounts = new Map<number, { taxCode: number }>();
  if (numbers.length === 0) {
    return accounts;
  }
  const { rows } = await db.listRows<LedgerAccounts>("app", "ledger_accounts", [
    Query.equal("account_number", numbers),
    Query.equal("active", true),
    Query.limit(ACCOUNT_FETCH_LIMIT),
  ]);
  for (const row of rows) {
    const inRange =
      row.account_number >= FIRST_COST_ACCOUNT &&
      row.account_number < END_COST_ACCOUNT;
    if (row.active && inRange && numbers.includes(row.account_number)) {
      accounts.set(row.account_number, { taxCode: row.tax_code ?? 0 });
    }
  }
  return accounts;
}

async function loadDepartmentShare(
  db: Db,
  departmentId: string
): Promise<Lists["shareClass"]> {
  try {
    const department = await db.getRow<Departments>(
      "app",
      "departments",
      departmentId,
      [Query.select(["$id", "project_share"])]
    );
    return shareClass(department.project_share ?? null);
  } catch (error) {
    console.warn(
      `[expense-check] could not read department ${departmentId}'s project share:`,
      error
    );
    return "unknown";
  }
}

/**
 * The live lists every value is checked against. A failure to read the types,
 * accounts or projects throws before anything is written, so the fixed steps
 * take over; website event dates are a nicety and may be missing.
 */
async function loadLists(
  db: Db,
  expense: CheckedExpense,
  answer: CheckAnswer,
  today: string
): Promise<Lists> {
  const departmentId = expense.department;
  const numbers = [
    ...new Set(
      answer.receipts.flatMap((r) =>
        Number.isInteger(r.accountNumber) ? [r.accountNumber as number] : []
      )
    ),
  ];
  const [allTypes, accounts, projects, usage, share, siteEvents] =
    await Promise.all([
      loadAllCostTypes(db),
      loadAccounts(db, numbers),
      db
        .listRows<FinagoProjects>("app", "finago_projects", [
          Query.limit(PROJECT_FETCH_LIMIT),
        ])
        .then((result) => result.rows),
      departmentId
        ? db
            .listRows<FinagoProjectUsage>("app", "finago_project_usage", [
              Query.equal("department_id", departmentId),
              Query.limit(USAGE_FETCH_LIMIT),
            ])
            .then((result) => result.rows)
        : Promise.resolve([] as FinagoProjectUsage[]),
      departmentId
        ? loadDepartmentShare(db, departmentId)
        : Promise.resolve("unknown" as const),
      departmentId
        ? departmentEvents(db, departmentId, today).catch(() => [])
        : Promise.resolve([] as SiteEvent[]),
    ]);
  const candidates = departmentId
    ? departmentCandidates({ departmentId, projects, today, usage })
    : [];
  return {
    accounts,
    candidates: new Map(candidates.map((p) => [p.project_id, p])),
    projects,
    shareClass: share,
    siteEvents,
    types: new Map(activeCostTypes(allTypes).map((t) => [t.slug, t])),
  };
}

// --- Types and accounts -----------------------------------------------------

function disagree(work: Work, row: Row, slug: string, reason: string): void {
  flag(
    work,
    {
      attachmentId: row.$id,
      code: "ai_check_disagrees",
      data: { aiType: slug, reason: hintText(reason) },
    },
    `Thinks the type is ${slug}: ${reason}`
  );
}

function setType(
  work: Work,
  row: Row,
  type: CostTypeOption,
  proposal: ReceiptAnswer
): void {
  const confidence = confidenceOf(proposal.confidence.type);
  const before = row.cost_type;
  // No type source: the AI's pick that nobody saw yet, so it teaches only
  // once a person confirms it, and the fixed steps never decide it again.
  patch(work, row, {
    account_number: type.accountNumber,
    account_source: ExpenseAttachmentsAccountSource.TYPE,
    ai_confidence: confidence,
    ai_cost_type: type.slug,
    cost_type: type.slug,
    tax_code: type.taxCode ?? null,
    type_source: null,
  });
  markStale(work, row, TYPE_DECISION_HINTS);
  work.changes.push({
    after: type.slug,
    before,
    field: "cost_type",
    receiptId: row.$id,
  });
  work.events.push({
    action: "ai_classified",
    actorKind: "ai",
    actorName: CHECK_ACTOR,
    after: type.slug,
    attachmentId: row.$id,
    before,
    expenseId: work.expenseId,
    field: "cost_type",
    note: noteOf(confidence, proposal.reason),
  });
  if (row.type_source === ExpenseAttachmentsTypeSource.LEGACY_APP && before) {
    addHint(work, {
      attachmentId: row.$id,
      code: "app_type_replaced",
      data: { aiType: type.slug, appType: before },
    });
  }
  if (confidence < AI_TYPE_CONFIDENCE_THRESHOLD) {
    flag(
      work,
      {
        attachmentId: row.$id,
        code: "type_unsure",
        data: { reason: hintText(proposal.reason) },
      },
      `Not sure of the type: ${proposal.reason}`
    );
  }
}

/**
 * The type: never on own text (the student's words stay), never over a
 * person's choice (a student's gets `ai_check_disagrees` instead), and only
 * an active type.
 */
function applyType(
  work: Work,
  row: Row,
  proposal: ReceiptAnswer,
  lists: Lists
): void {
  const slug = proposal.type?.trim();
  if (!slug || isOwnText(row)) {
    return;
  }
  const type = lists.types.get(slug);
  if (!type) {
    flag(work, {
      attachmentId: row.$id,
      code: "type_unsure",
      data: {
        reason: hintText(
          `The check suggested the type "${quoted(slug)}", which is not an active type, so it was not used.`
        ),
      },
    });
    return;
  }
  const chosen =
    CHOSEN_TYPE_SOURCES.has(row.type_source) ||
    PERSON_SOURCES.has(row.account_source);
  if (chosen) {
    if (
      slug !== row.cost_type &&
      row.type_source === ExpenseAttachmentsTypeSource.STUDENT
    ) {
      disagree(work, row, slug, proposal.reason);
    }
    return;
  }
  if (slug !== row.cost_type) {
    setType(work, row, type, proposal);
  }
}

/** The account for the student's own text: an active cost account (4000-7999) only. */
function applyAccount(
  work: Work,
  row: Row,
  proposal: ReceiptAnswer,
  lists: Lists
): void {
  const number = proposal.accountNumber;
  if (
    number === undefined ||
    !isOwnText(row) ||
    PERSON_SOURCES.has(row.account_source)
  ) {
    return;
  }
  const account = lists.accounts.get(number);
  if (!account) {
    flag(work, {
      attachmentId: row.$id,
      code: "ai_account_unsure",
      data: {
        reason: hintText(
          `The check suggested account ${number}, which is not an active cost account (4000-7999), so it was not used.`
        ),
      },
    });
    return;
  }
  if (row.account_number === number) {
    return;
  }
  const confidence = confidenceOf(proposal.confidence.account);
  patch(work, row, {
    account_number: number,
    account_source: ExpenseAttachmentsAccountSource.AI_FREEFORM,
    tax_code: account.taxCode,
  });
  markStale(work, row, ACCOUNT_DECISION_HINTS);
  work.changes.push({
    after: number,
    before: row.account_number,
    field: "account_number",
    receiptId: row.$id,
  });
  work.events.push({
    action: "ai_account_chosen",
    actorKind: "ai",
    actorName: CHECK_ACTOR,
    after: String(number),
    attachmentId: row.$id,
    before: row.cost_type_text,
    expenseId: work.expenseId,
    field: "account_number",
    note: noteOf(confidence, proposal.reason),
  });
  if (confidence < AI_TYPE_CONFIDENCE_THRESHOLD) {
    flag(
      work,
      {
        attachmentId: row.$id,
        code: "ai_account_unsure",
        data: { reason: hintText(proposal.reason) },
      },
      `Not sure of the account: ${proposal.reason}`
    );
  }
}

// --- Projects ---------------------------------------------------------------

/** The series as finance writes it: the newest edition's name without its year. */
function seriesLabel(editions: FinagoProjects[], series: string): string {
  const newest = [...editions].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
  const label = (newest?.name ?? "")
    .replace(FOUR_DIGIT_YEARS, " ")
    .replace(WHITESPACE_RUN, " ")
    .trim()
    .replace(TRAILING_TWO_DIGITS, "")
    .replace(EDGE_PUNCTUATION, "");
  return label || series;
}

function editionsOf(lists: Lists, series: string): FinagoProjects[] {
  return lists.projects.filter((project) => seriesOf(project) === series);
}

function timingFor(
  lists: Lists,
  series: string,
  receiptDay: string
): SeriesTiming {
  return editionTiming({
    editions: lists.projects,
    receiptDate: receiptDay,
    series,
    websiteEventDates: websiteDates(
      editionsOf(lists, series),
      series,
      lists.siteEvents
    ),
  });
}

/**
 * A dated edition the receipt came after, more than just after it: last
 * year's project. Null when the edition is the next one, the one just held,
 * a later one, or has no year or date to tell.
 */
function heldBefore(
  project: FinagoProjects,
  receiptDay: string | null,
  lists: Lists
): SeriesTiming | null {
  if (!receiptDay || project.year === null) {
    return null;
  }
  const timing = timingFor(lists, seriesOf(project), receiptDay);
  const projectId = project.project_id;
  if (timing.suggested === projectId || timing.recentlyHeld === projectId) {
    return null;
  }
  const own = timing.editions.find((e) => e.projectId === projectId);
  return own?.eventDate && own.eventDate < receiptDay ? timing : null;
}

function refuseHeldEdition(
  work: Work,
  row: Row,
  project: FinagoProjects,
  timing: SeriesTiming,
  lists: Lists
): void {
  if (timing.missing) {
    const series = seriesLabel(
      editionsOf(lists, timing.missing.series),
      timing.missing.series
    );
    flag(
      work,
      {
        attachmentId: row.$id,
        code: "project_not_created",
        data: { series, year: timing.missing.year },
      },
      `${project.name} was already held before this receipt, and ${series} ${timing.missing.year} is not in Finago yet`
    );
    return;
  }
  const next = timing.suggested
    ? lists.projects.find((p) => p.project_id === timing.suggested)?.name
    : null;
  flag(work, {
    attachmentId: row.$id,
    code: "project_unsure",
    data: {
      reason: hintText(
        `${project.name} was already held before this receipt${next ? `; the next edition is ${next}` : ""}. ${work.reasons.get(row.$id) ?? ""}`
      ),
    },
  });
}

/**
 * The project: one of the department's active candidates, never an edition
 * held before the receipt that it doesn't belong to (last year's), and never
 * over a person's choice.
 */
function applyProject(
  work: Work,
  row: Row,
  proposal: ReceiptAnswer,
  lists: Lists
): void {
  const projectId = proposal.projectId?.trim();
  if (
    !projectId ||
    projectId.toLowerCase() === "none" ||
    PERSON_SOURCES.has(row.project_source)
  ) {
    return;
  }
  const project = lists.candidates.get(projectId);
  if (!project) {
    flag(work, {
      attachmentId: row.$id,
      code: "project_unsure",
      data: {
        reason: hintText(
          `The check suggested project "${quoted(projectId)}", which is not one of the department's active projects, so it was not used.`
        ),
      },
    });
    return;
  }
  const day = row.date ? receiptDateInOslo(row.date) : null;
  const held = heldBefore(project, day, lists);
  if (held) {
    refuseHeldEdition(work, row, project, held, lists);
    return;
  }
  if (row.project_id === project.project_id) {
    work.projectSet.add(row.$id);
    return;
  }
  const confidence = confidenceOf(proposal.confidence.project);
  patch(work, row, {
    project_confidence: confidence,
    project_id: project.project_id,
    project_name: project.name,
    project_source: ExpenseAttachmentsProjectSource.AI_CHECK,
  });
  work.projectSet.add(row.$id);
  work.changes.push({
    after: project.name,
    before: row.project_name,
    field: "project",
    receiptId: row.$id,
  });
  work.events.push({
    action: "edited",
    actorKind: "ai",
    actorName: CHECK_ACTOR,
    after: project.name,
    attachmentId: row.$id,
    before: row.project_name,
    expenseId: work.expenseId,
    field: "project",
    note: noteOf(confidence, proposal.reason),
  });
  if (confidence < AI_TYPE_CONFIDENCE_THRESHOLD) {
    flag(
      work,
      {
        attachmentId: row.$id,
        code: "project_unsure",
        data: { reason: hintText(proposal.reason) },
      },
      `Not sure of the project: ${proposal.reason}`
    );
  }
}

// --- Flags ------------------------------------------------------------------

function hasProject(work: Work, row: Row | undefined): boolean {
  return Boolean(row && (work.projectSet.has(row.$id) || row.project_id));
}

/**
 * A "not created yet" the code can confirm: a series the department books on,
 * and a year after every edition of it in Finago.
 */
function confirmedMissing(
  flagged: CheckFlag,
  lists: Lists
): { series: string; year: number } | null {
  const parsed = parseProjectName(flagged.series ?? "");
  const year = flagged.year ?? parsed.year;
  const series = parsed.series.trim();
  if (!(series && year)) {
    return null;
  }
  const booked = new Set([...lists.candidates.values()].map(seriesOf));
  const editions = editionsOf(lists, series);
  const years = editions.flatMap((p) => (p.year === null ? [] : [p.year]));
  if (!booked.has(series) || years.some((known) => known >= year)) {
    return null;
  }
  return { series: seriesLabel(editions, series), year };
}

function applyNotCreated(
  work: Work,
  flagged: CheckFlag,
  attachmentId: string | undefined,
  lists: Lists
): void {
  const missing = confirmedMissing(flagged, lists);
  if (missing) {
    flag(
      work,
      { attachmentId, code: "project_not_created", data: missing },
      `${missing.series} ${missing.year} is not in Finago yet: ${flagged.note}`
    );
    return;
  }
  flag(work, {
    attachmentId,
    code: "project_unsure",
    data: {
      reason: hintText(
        `The check said the project ${quoted(`${flagged.series ?? ""} ${flagged.year ?? ""}`.trim())} is not in Finago yet, which the project list does not confirm. ${flagged.note}`
      ),
    },
  });
}

/** The agent's own flags, for receipts of this expense or the whole expense. */
function applyFlags(
  work: Work,
  flags: CheckFlag[],
  byId: Map<string, Row>,
  lists: Lists
): void {
  for (const flagged of flags) {
    const row = flagged.receiptId ? byId.get(flagged.receiptId) : undefined;
    if (flagged.receiptId && !(row && isReceipt(row))) {
      continue;
    }
    const attachmentId = row?.$id;
    const data = { reason: hintText(flagged.note) };
    switch (flagged.code) {
      case "type_unsure":
        flag(work, { attachmentId, code: "type_unsure", data });
        break;
      case "account_unsure":
        if (row && isOwnText(row)) {
          flag(work, { attachmentId, code: "ai_account_unsure", data });
        }
        break;
      case "project_unsure":
        flag(work, { attachmentId, code: "project_unsure", data });
        break;
      case "project_missing":
        if (!hasProject(work, row)) {
          flag(work, { attachmentId, code: "project_missing", data });
        }
        break;
      case "project_not_created":
        if (!hasProject(work, row)) {
          applyNotCreated(work, flagged, attachmentId, lists);
        }
        break;
      default:
        break;
    }
  }
}

/** A department that books nearly everything on a project: a receipt with none is flagged. */
function flagMissingProjects(
  work: Work,
  rows: Row[],
  answered: Map<string, ReceiptAnswer>,
  lists: Lists
): void {
  if (lists.shareClass !== "expected") {
    return;
  }
  const projectHint = (row: Row) =>
    work.hints.some(
      (hint) =>
        PROJECT_HINTS.has(hint.code) &&
        (hint.attachmentId === row.$id || hint.attachmentId === undefined)
    );
  for (const row of rows) {
    if (!isReceipt(row) || hasProject(work, row) || projectHint(row)) {
      continue;
    }
    const reason =
      answered.get(row.$id)?.reason ??
      "The department books almost every cost on a project, and the check found none for this receipt.";
    flag(work, {
      attachmentId: row.$id,
      code: "project_missing",
      data: { reason: hintText(reason) },
    });
  }
}

// --- Writing ----------------------------------------------------------------

async function save(
  db: Db,
  expense: CheckedExpense,
  work: Work
): Promise<void> {
  await Promise.all(
    [...work.patches].map(([rowId, data]) =>
      db.updateRow("app", "expense_attachments", rowId, data)
    )
  );
  if (work.hints.length > 0 || work.stale.size > 0) {
    const kept = parseApproverHints(expense.approver_hints).filter(
      (hint) =>
        !(
          (hint.attachmentId &&
            work.stale.get(hint.attachmentId)?.has(hint.code)) ||
          work.hints.some((fresh) => sameHint(fresh, hint))
        )
    );
    await db.updateRow("app", "expense", expense.$id, {
      approver_hints: hintsJson([...kept, ...work.hints]),
    });
  }
  await recordExpenseEvents(db, work.events);
}

/**
 * Checks the agent's answer against the live lists and stores what passes:
 * receipt types, own-text accounts (`ai_freeform`) and projects
 * (`project_source: "ai_check"`), with an `expense_events` row for every
 * change and flag, and approver hints for the flags. Throws before writing
 * anything when the lists can't be read.
 */
export async function applyCheck(
  db: Db,
  expense: CheckedExpense,
  answer: CheckAnswer,
  ctx: ApplyContext
): Promise<{ changes: AppliedChange[]; hints: ApproverHint[] }> {
  const rows = expense.expenseAttachments ?? [];
  const byId = new Map(rows.map((row) => [row.$id, row]));
  const lists = await loadLists(db, expense, answer, ctx.today);
  const work: Work = {
    changes: [],
    events: [],
    expenseId: expense.$id,
    hints: [],
    patches: new Map(),
    projectSet: new Set(),
    reasons: new Map(),
    stale: new Map(),
  };
  const answered = new Map<string, ReceiptAnswer>();
  for (const proposal of answer.receipts) {
    const row = byId.get(proposal.receiptId);
    if (!row) {
      console.warn(
        `[expense-check] ${expense.$id}: the answer names a receipt that is not on this expense; skipped`
      );
      continue;
    }
    if (answered.has(row.$id) || !isReceipt(row)) {
      continue;
    }
    answered.set(row.$id, proposal);
    work.reasons.set(row.$id, proposal.reason);
    applyType(work, row, proposal, lists);
    applyAccount(work, row, proposal, lists);
    applyProject(work, row, proposal, lists);
  }
  applyFlags(work, answer.flags, byId, lists);
  flagMissingProjects(work, rows, answered, lists);
  await save(db, expense, work);
  return { changes: work.changes, hints: work.hints };
}
