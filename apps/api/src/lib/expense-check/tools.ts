// The read-only tools the background check's agent calls. Every tool returns a
// short `{ error }` result instead of throwing, so one failing lookup never
// ends the run, and every piece of stored text is untrusted: one line, capped,
// quotes and arrows stripped (`cleanExampleText`).

import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import {
  type Departments,
  type Events,
  EventsStatus,
  type ExpenseAttachments,
  type ExpenseTypeExamples,
  type FinagoProjects,
  type FinagoProjectUsage,
  type LedgerAccounts,
} from "@repo/api/types/appwrite";
import {
  exampleTeaches,
  normalizeVendor,
} from "@repo/shared/utils/expense-examples";
import {
  departmentCandidates,
  editionTiming,
  type SeriesTiming,
  seriesOf,
  shareClass,
} from "@repo/shared/utils/finago-projects";
import { receiptFileId } from "@repo/shared/utils/receipt-file-id";
import { tool } from "ai";
import { z } from "zod";
import { todayInOslo } from "../receipt-date";
import { cleanExampleText, fitFileForModel } from "../receipt-scan";

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;

export interface ToolDeps {
  db: AdminClient["db"];
  storage: AdminClient["storage"];
  /** Today in Oslo, `YYYY-MM-DD`; defaults to the real day. */
  today?: string;
}

const TOOL_TIMEOUT_MS = 5000;
const VIEW_RECEIPT_TIMEOUT_MS = 15_000;
const MAX_VIEW_RECEIPT_CALLS = 3;
const EXPENSES_BUCKET = "expenses";

const MAX_EXAMPLES = 15;
const EXAMPLE_FETCH_LIMIT = 30;
const MAX_KEYWORDS = 5;
const KEYWORD = /\p{L}{3,}/gu;
const WHITESPACE = /\s+/;
const PREFIX_WORDS = 2;

const MAX_ACCOUNTS = 20;
const LEDGER_LIMIT = 1000;
const FIRST_COST_ACCOUNT = 4000;
const END_COST_ACCOUNT = 8000;

const MAX_EVENTS = 20;
const EVENT_FETCH_LIMIT = 100;
const PROJECT_FETCH_LIMIT = 5000;
const USAGE_FETCH_LIMIT = 500;
const MAX_SERIES = 10;
const MAX_RECEIPT_DATES = 5;
const MAX_CANDIDATES = 30;
const DAY_LENGTH = 10;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const dayString = z.string().regex(ISO_DAY, "Use YYYY-MM-DD");

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), ms);
  });
  return Promise.race([work, limit]).finally(() => clearTimeout(timer));
}

/** Like `Promise.all`, but leaves no second rejection unhandled. */
async function allOrThrow<T extends readonly unknown[]>(
  promises: {
    [K in keyof T]: Promise<T[K]>;
  }
): Promise<T> {
  const settled = await Promise.allSettled(promises);
  const failed = settled.find((r) => r.status === "rejected");
  if (failed) {
    throw failed.reason;
  }
  return settled.map(
    (r) => (r as PromiseFulfilledResult<unknown>).value
  ) as unknown as T;
}

/** Runs a tool body within its limit; any failure becomes a short error result. */
async function guarded<T extends object>(
  name: string,
  ms: number,
  body: () => Promise<T>
): Promise<T | { error: string }> {
  try {
    return await withTimeout(body(), ms);
  } catch (error) {
    console.warn(`[expense-check] ${name} failed:`, error);
    const timedOut = error instanceof Error && error.message === "timed out";
    return { error: timedOut ? "The lookup timed out" : "The lookup failed" };
  }
}

const text = (value: string | null | undefined): string =>
  cleanExampleText(value ?? "");

// --- search_past_bookings ---------------------------------------------------

function typeChooser(
  row: ExpenseTypeExamples
): "student" | "approver" | "admin" {
  const origin = row.type_source ?? row.source;
  return origin === "approver" || origin === "admin" ? origin : "student";
}

function rank(row: ExpenseTypeExamples, departmentId?: string): number {
  return (
    (row.confirmed === true ? 4 : 0) +
    (typeChooser(row) === "student" ? 0 : 2) +
    (departmentId && row.department_id === departmentId ? 1 : 0)
  );
}

function keywordsOf(value: string | undefined): string[] {
  const words = value?.match(KEYWORD) ?? [];
  return [...new Set(words.map((w) => w.toLowerCase()))].slice(0, MAX_KEYWORDS);
}

function exampleGroups(input: {
  departmentId?: string;
  text?: string;
  vendor?: string;
}): string[][] {
  const groups: string[][] = [];
  const vendorKey = normalizeVendor(input.vendor);
  if (vendorKey) {
    const prefix = vendorKey.split(WHITESPACE).slice(0, PREFIX_WORDS).join(" ");
    groups.push([Query.equal("vendor_key", vendorKey)]);
    groups.push([
      Query.startsWith(
        "vendor_key",
        prefix === vendorKey ? `${vendorKey} ` : prefix
      ),
    ]);
  }
  const keywords = keywordsOf(input.text);
  if (keywords.length > 0) {
    groups.push([Query.search("description", keywords.join(" "))]);
  }
  if (groups.length === 0) {
    groups.push(
      input.departmentId
        ? [Query.equal("department_id", input.departmentId)]
        : []
    );
  }
  return groups;
}

function presentExample(row: ExpenseTypeExamples, departmentId?: string) {
  const confirmed = row.confirmed === true;
  return {
    account: row.account_number ?? null,
    accountChosenBy: row.account_source ?? null,
    confirmed,
    description: text(row.description),
    sameDepartment: Boolean(departmentId) && row.department_id === departmentId,
    text: row.final_text ? text(row.final_text) : null,
    type: row.final_cost_type ? text(row.final_cost_type) : null,
    typeChosenBy: typeChooser(row),
    vendor: text(row.vendor_key),
    // Who chose the project is not stored, so only a confirmed booking's
    // project is shown; the check's own unconfirmed picks never are.
    project: confirmed && row.project_name ? text(row.project_name) : null,
  };
}

function searchPastBookings({ db }: ToolDeps) {
  return tool({
    description:
      "Search earlier bookings of other students' receipts, by shop, words or type, to see which cost type, own-text account and (on confirmed ones) project were used. Includes rows booked with an own text and account. Up to 15, best first.",
    inputSchema: z.object({
      departmentId: z.string().max(50).optional(),
      text: z.string().max(200).optional(),
      typeSlug: z.string().max(100).optional(),
      vendor: z.string().max(100).optional(),
    }),
    execute: (input) =>
      guarded("search_past_bookings", TOOL_TIMEOUT_MS, async () => {
        const base = input.typeSlug
          ? [Query.equal("final_cost_type", input.typeSlug)]
          : [];
        const seen = new Set<string>();
        const rows: ExpenseTypeExamples[] = [];
        let failed = 0;
        const groups = exampleGroups(input);
        for (const group of groups) {
          const found = await db
            .listRows<ExpenseTypeExamples>("app", "expense_type_examples", [
              ...base,
              ...group,
              Query.orderDesc("$createdAt"),
              Query.limit(EXAMPLE_FETCH_LIMIT),
            ])
            .then((result) => result.rows)
            .catch((error: unknown) => {
              console.warn("[expense-check] A search failed:", error);
              failed += 1;
              return [];
            });
          for (const row of found) {
            // An own-text row has no type; its text stands in for it.
            const teaches = exampleTeaches({
              ...row,
              final_cost_type: row.final_cost_type ?? row.final_text,
            });
            if (teaches && !seen.has(row.$id)) {
              seen.add(row.$id);
              rows.push(row);
            }
          }
        }
        if (failed === groups.length) {
          throw new Error("Every search failed");
        }
        const best = rows
          .sort(
            (a, b) => rank(b, input.departmentId) - rank(a, input.departmentId)
          )
          .slice(0, MAX_EXAMPLES);
        return {
          examples: best.map((row) => presentExample(row, input.departmentId)),
        };
      }),
  });
}

// --- list_projects ----------------------------------------------------------

function titleOf(event: Events): string {
  const refs = Array.isArray(event.translation_refs)
    ? event.translation_refs
    : [];
  return text(refs.find((ref) => ref?.title?.trim())?.title);
}

async function departmentEvents(
  db: ToolDeps["db"],
  departmentId: string
): Promise<{ date: string; title: string }[]> {
  const { rows } = await db.listRows<Events>("app", "events", [
    Query.equal("department_id", departmentId),
    Query.equal("status", EventsStatus.PUBLISHED),
    Query.orderAsc("start_date"),
    Query.select(["$id", "start_date", "translation_refs.title"]),
    Query.limit(EVENT_FETCH_LIMIT),
  ]);
  return rows.flatMap((event) => {
    const title = titleOf(event);
    return event.start_date && title
      ? [{ date: event.start_date.slice(0, DAY_LENGTH), title }]
      : [];
  });
}

/** Website event dates per edition: a department event naming the series, in the edition's year. */
function websiteDates(
  editions: FinagoProjects[],
  series: string,
  events: { date: string; title: string }[]
): Map<string, string> {
  const dates = new Map<string, string>();
  const named = events.filter((event) =>
    event.title.toLowerCase().includes(series)
  );
  for (const edition of editions) {
    const hit = named.find((e) => Number(e.date.slice(0, 4)) === edition.year);
    if (hit) {
      dates.set(edition.project_id, hit.date);
    }
  }
  return dates;
}

function presentTiming(receiptDate: string, timing: SeriesTiming) {
  return {
    inactiveNext: timing.inactiveNext,
    missing: timing.missing,
    receiptDate,
    recentlyHeld: timing.recentlyHeld,
    suggested: timing.suggested,
  };
}

function listProjects({ db, today }: ToolDeps) {
  return tool({
    description:
      "The Finago projects a department usually books on, per series (e.g. a yearly event) with each edition's event date, which edition each receipt date belongs to (suggested / recentlyHeld), a missing next edition or a closed one (inactiveNext), and how often the department books on a project at all (expected / sometimes / rare).",
    inputSchema: z.object({
      departmentId: z.string().max(50),
      receiptDates: z.array(dayString).max(20),
    }),
    execute: ({ departmentId, receiptDates }) =>
      guarded("list_projects", TOOL_TIMEOUT_MS, async () => {
        const [projects, usage, department, events] = await allOrThrow([
          db
            .listRows<FinagoProjects>("app", "finago_projects", [
              Query.limit(PROJECT_FETCH_LIMIT),
            ])
            .then((r) => r.rows),
          db
            .listRows<FinagoProjectUsage>("app", "finago_project_usage", [
              Query.equal("department_id", departmentId),
              Query.limit(USAGE_FETCH_LIMIT),
            ])
            .then((r) => r.rows),
          (async () =>
            await db.getRow<Departments>("app", "departments", departmentId, [
              Query.select(["project_share"]),
            ]))().catch(() => null),
          departmentEvents(db, departmentId).catch(() => []),
        ]);
        // Every row, active or not: a closed past edition is what makes the
        // next year's a candidate (the function itself returns active ones).
        const candidates = departmentCandidates({
          departmentId,
          projects,
          today: today ?? todayInOslo(),
          usage,
        });
        const dates = [...new Set(receiptDates)].slice(0, MAX_RECEIPT_DATES);
        const seriesList = [...new Set(candidates.map(seriesOf))].slice(
          0,
          MAX_SERIES
        );
        return {
          candidates: candidates.slice(0, MAX_CANDIDATES).map((p) => ({
            name: text(p.name),
            projectId: p.project_id,
            series: text(seriesOf(p)),
            year: p.year,
          })),
          series: seriesList.map((series) => {
            const editions = projects.filter((p) => seriesOf(p) === series);
            const websiteEventDates = websiteDates(editions, series, events);
            const timings = dates.map((receiptDate) => ({
              receiptDate,
              timing: editionTiming({
                editions: projects,
                receiptDate,
                series,
                websiteEventDates,
              }),
            }));
            return {
              editions: (
                timings[0]?.timing.editions ??
                editionTiming({
                  editions: projects,
                  receiptDate: dates[0] ?? today ?? todayInOslo(),
                  series,
                  websiteEventDates,
                }).editions
              ).map((e) => ({
                active: editions.find((p) => p.project_id === e.projectId)
                  ?.active,
                eventDate: e.eventDate,
                eventDateSource: e.eventDateSource,
                name: text(e.name),
                projectId: e.projectId,
                year: e.year,
              })),
              series: text(series),
              timings: timings.map((t) =>
                presentTiming(t.receiptDate, t.timing)
              ),
            };
          }),
          shareClass: shareClass(department?.project_share ?? null),
        };
      }),
  });
}

// --- find_events ------------------------------------------------------------

function findEvents({ db }: ToolDeps) {
  return tool({
    description:
      "Published, not cancelled website events in a date window, optionally of one department and with a word in the title. Up to 20.",
    inputSchema: z.object({
      departmentId: z.string().max(50).optional(),
      from: dayString,
      text: z.string().max(100).optional(),
      to: dayString,
    }),
    execute: (input) =>
      guarded("find_events", TOOL_TIMEOUT_MS, async () => {
        const { rows } = await db.listRows<Events>("app", "events", [
          Query.equal("status", EventsStatus.PUBLISHED),
          Query.between(
            "start_date",
            `${input.from}T00:00:00.000`,
            `${input.to}T23:59:59.999`
          ),
          ...(input.departmentId
            ? [Query.equal("department_id", input.departmentId)]
            : []),
          Query.orderAsc("start_date"),
          Query.select([
            "$id",
            "start_date",
            "department_id",
            "translation_refs.title",
          ]),
          Query.limit(EVENT_FETCH_LIMIT),
        ]);
        const needle = input.text?.trim().toLowerCase();
        const events = rows
          .flatMap((event) => {
            const title = titleOf(event);
            return event.start_date && title
              ? [
                  {
                    date: event.start_date.slice(0, DAY_LENGTH),
                    departmentId: event.department_id ?? null,
                    title,
                  },
                ]
              : [];
          })
          .filter((e) => !needle || e.title.toLowerCase().includes(needle))
          .slice(0, MAX_EVENTS);
        return { events };
      }),
  });
}

// --- search_accounts --------------------------------------------------------

function searchAccounts({ db }: ToolDeps) {
  return tool({
    description:
      "Search the active cost accounts (4000-7999) by a word in the name or by number. Up to 20.",
    inputSchema: z.object({ text: z.string().min(1).max(100) }),
    execute: ({ text: query }) =>
      guarded("search_accounts", TOOL_TIMEOUT_MS, async () => {
        const needle = query.trim().toLowerCase();
        const { rows } = await db.listRows<LedgerAccounts>(
          "app",
          "ledger_accounts",
          [Query.equal("active", true), Query.limit(LEDGER_LIMIT)]
        );
        const accounts = rows
          .filter(
            (row) =>
              row.active &&
              row.account_number >= FIRST_COST_ACCOUNT &&
              row.account_number < END_COST_ACCOUNT &&
              (String(row.account_number).startsWith(needle) ||
                (row.name ?? "").toLowerCase().includes(needle))
          )
          .sort((a, b) => a.account_number - b.account_number)
          .slice(0, MAX_ACCOUNTS)
          .map((row) => ({ name: text(row.name), number: row.account_number }));
        return { accounts };
      }),
  });
}

export function createCheckTools(deps: ToolDeps) {
  return {
    find_events: findEvents(deps),
    list_projects: listProjects(deps),
    search_accounts: searchAccounts(deps),
    search_past_bookings: searchPastBookings(deps),
  };
}

// --- view_receipt -----------------------------------------------------------

type ReceiptResult = { error: string } | { base64: string; mediaType: string };

/**
 * Made per run: it only serves receipts of `expenseId` and at most three
 * times. The file goes to the model through `toModelOutput`; the result the
 * run logs stays small.
 */
export function createViewReceiptTool(deps: ToolDeps, expenseId: string) {
  let calls = 0;
  return tool<{ receiptId: string }, ReceiptResult, Record<string, never>>({
    description:
      "Look at one receipt file of this expense (image or PDF). Use it only when the receipt's text read earlier is not enough. At most 3 per check.",
    inputSchema: z.object({ receiptId: z.string().min(1).max(50) }),
    execute: ({ receiptId }) =>
      guarded("view_receipt", VIEW_RECEIPT_TIMEOUT_MS, async () => {
        if (calls >= MAX_VIEW_RECEIPT_CALLS) {
          return { error: "Receipt view limit reached" };
        }
        const { rows } = await deps.db.listRows<ExpenseAttachments>(
          "app",
          "expense_attachments",
          [Query.equal("expense_id", expenseId), Query.limit(100)]
        );
        const attachment = rows.find((row) => row.$id === receiptId);
        const fileId = receiptFileId(attachment?.url);
        if (!(attachment && fileId)) {
          return { error: "That receipt is not part of this expense" };
        }
        calls += 1;
        const bytes = await deps.storage.getFileDownload(
          EXPENSES_BUCKET,
          fileId
        );
        const file = await fitFileForModel(
          Buffer.from(bytes as ArrayBuffer),
          attachment.type
        );
        return {
          base64: file.data.toString("base64"),
          mediaType: file.mediaType,
        };
      }),
    toModelOutput: ({ output }) => {
      if ("error" in output) {
        return { type: "error-text", value: output.error };
      }
      return {
        type: "content",
        value: [
          {
            type: "file",
            data: { type: "data", data: output.base64 },
            mediaType: output.mediaType,
          },
        ],
      };
    },
  });
}
