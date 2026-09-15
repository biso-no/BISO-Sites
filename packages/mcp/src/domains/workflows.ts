/**
 * Composite workflows.
 *
 * Both tools here are **deterministic aggregation**: they run real queries and
 * arrange the results. Neither calls a language model, so neither needs a
 * provider key, and neither can hallucinate an item that is not in the data.
 * The MCP client's own model does the interpreting — which is the right split,
 * because it already has the user's question and this server does not.
 *
 * Every finding carries the id it came from, so a model relaying one can link
 * to the thing rather than paraphrasing it.
 */

import { z } from "zod";
import { campusLabel } from "../identity/campus";
import { isAnonymous } from "../identity/principal";
import { describeScope } from "../identity/scope";
import { defineTool, type ToolModule } from "../runtime/register";
import type { ContentSummary } from "../services/content";
import { hasRecruitmentAccess } from "../services/recruitment";
import { newRequestId, READ_ONLY, result, STAFF_PROFILES } from "./shared";

const DAY_MS = 86_400_000;
const BRIEFING_LIMIT = 25;
const AUDIT_LIMIT = 50;

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export interface BriefingFinding {
  /** The rows this refers to, always by id. */
  items: Array<{ id: string; title: string | null; link: string | null }>;
  /** Why this is on the list. */
  kind: string;
  message: string;
  severity: "info" | "attention" | "urgent";
}

const STALE_DRAFT_DAYS = 14;

type BriefingContext = Parameters<
  NonNullable<(typeof workflowsModule.tools)[0]["handler"]>
>[1];

function toItems(rows: ContentSummary[]): BriefingFinding["items"] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? row.slug,
    link: row.links.admin ?? null,
  }));
}

function noteFailure(warnings: string[], what: string, error: unknown): void {
  warnings.push(
    `${what} could not be read: ${error instanceof Error ? error.message : "unknown error"}`
  );
}

async function collectUpcomingEvents(
  context: BriefingContext,
  campusId: string | undefined,
  horizon: number,
  warnings: string[]
): Promise<BriefingFinding[]> {
  try {
    const events = await context.services.content.search(context.principal, {
      domain: "events",
      status: "published",
      campusId,
      limit: BRIEFING_LIMIT,
      offset: 0,
    });
    const now = new Date().toISOString();
    const horizonAt = daysFromNow(horizon);
    const soon = events.rows.filter((row) => {
      const start = row.fields.start_date;
      return typeof start === "string" && start >= now && start <= horizonAt;
    });
    if (soon.length === 0) {
      return [];
    }
    return [
      {
        kind: "events_starting_soon",
        severity: "info",
        message: `${soon.length} published event(s) start within ${horizon} days.`,
        items: toItems(soon),
      },
    ];
  } catch (error) {
    noteFailure(warnings, "Events", error);
    return [];
  }
}

async function collectStaleDrafts(
  context: BriefingContext,
  campusId: string | undefined,
  warnings: string[]
): Promise<BriefingFinding[]> {
  const findings: BriefingFinding[] = [];
  for (const domain of ["events", "news"] as const) {
    try {
      const drafts = await context.services.content.search(context.principal, {
        domain,
        status: "draft",
        campusId,
        limit: BRIEFING_LIMIT,
        offset: 0,
      });
      if (drafts.rows.length === 0) {
        continue;
      }
      const cutoff = isoDaysAgo(STALE_DRAFT_DAYS);
      const stale = drafts.rows.filter((row) => row.updatedAt < cutoff);
      findings.push({
        kind: `${domain}_drafts`,
        severity: stale.length > 0 ? "attention" : "info",
        message:
          stale.length > 0
            ? `${drafts.rows.length} unpublished ${domain} draft(s), ${stale.length} untouched for over ${STALE_DRAFT_DAYS} days.`
            : `${drafts.rows.length} unpublished ${domain} draft(s).`,
        items: toItems(drafts.rows),
      });
    } catch (error) {
      noteFailure(warnings, `${domain} drafts`, error);
    }
  }
  return findings;
}

async function collectClosingVacancies(
  context: BriefingContext,
  campusId: string | undefined,
  horizon: number,
  warnings: string[]
): Promise<BriefingFinding[]> {
  // A non-HR principal having no recruitment data is correct, not a failure,
  // so this is skipped silently rather than reported as an error.
  if (!hasRecruitmentAccess(context.principal)) {
    return [];
  }
  try {
    const vacancies = await context.services.recruitment.listVacancies(
      context.principal,
      { status: "published", campusId, limit: BRIEFING_LIMIT, offset: 0 }
    );
    const now = new Date().toISOString();
    const horizonAt = daysFromNow(horizon);
    const closing = vacancies.rows.filter(
      (row) =>
        row.applicationDeadline !== null &&
        row.applicationDeadline >= now &&
        row.applicationDeadline <= horizonAt
    );
    if (closing.length === 0) {
      return [];
    }
    return [
      {
        kind: "vacancies_closing",
        severity: "urgent",
        message: `${closing.length} vacancy/vacancies close within ${horizon} days.`,
        items: closing.map((row) => ({
          id: row.id,
          title: row.title ?? row.slug,
          link: context.links.admin(`/jobs/${row.id}`),
        })),
      },
    ];
  } catch (error) {
    noteFailure(warnings, "Vacancies", error);
    return [];
  }
}

async function collectInboxFindings(
  context: BriefingContext,
  warnings: string[]
): Promise<BriefingFinding[]> {
  try {
    const counts = await context.services.operations.inboxCounts(
      context.principal
    );
    const findings: BriefingFinding[] = [];
    if (counts.approvals > 0) {
      findings.push({
        kind: "pending_approvals",
        severity: "urgent",
        message: `${counts.approvals} approval request(s) await your decision.`,
        items: [],
      });
    }
    if (counts.submissions > 0) {
      findings.push({
        kind: "new_submissions",
        severity: "attention",
        message: `${counts.submissions} new form submission(s) are unhandled.`,
        items: [],
      });
    }
    return findings;
  } catch (error) {
    noteFailure(warnings, "Inbox counts", error);
    return [];
  }
}

export interface AuditIssue {
  id: string;
  link: string | null;
  problems: string[];
  title: string | null;
}

/** Checks that apply to every audited domain. */
function commonProblems(row: ContentSummary, domain: string): string[] {
  const problems: string[] = [];
  if (!row.locales.includes("no")) {
    problems.push("No Norwegian translation. Norwegian is authoritative.");
  }
  if (!row.locales.includes("en")) {
    problems.push("No English translation.");
  }
  if (!row.title) {
    problems.push("No title in the requested locale.");
  }
  if (!row.slug && domain !== "benefits") {
    problems.push("No slug, so the item has no public URL.");
  }
  return problems;
}

function eventProblems(row: ContentSummary, now: string): string[] {
  const problems: string[] = [];
  const end = row.fields.end_date ?? row.fields.start_date;
  if (typeof end === "string" && end < now && row.status === "published") {
    problems.push(`Still published but ended ${end.slice(0, 10)}.`);
  }
  if (
    row.fields.pricing_mode === "paid" &&
    !row.fields.member_price &&
    row.fields.member_only !== true
  ) {
    problems.push(
      "Paid event with no member price set; members will be charged the full price."
    );
  }
  return problems;
}

function benefitProblems(row: ContentSummary, now: string): string[] {
  const end = row.fields.publish_end;
  if (typeof end === "string" && end < now && row.status === "published") {
    return [
      `Still published but its publish window ended ${end.slice(0, 10)}.`,
    ];
  }
  return [];
}

function productProblems(row: ContentSummary): string[] {
  const problems: string[] = [];
  if (row.status === "published" && !row.fields.sales_type) {
    problems.push(
      "Published with no sales type, which blocks Finago ledger posting for its orders."
    );
  }
  if (
    row.fields.inventory_mode === "tracked" &&
    (row.fields.stock === null || row.fields.stock === undefined)
  ) {
    problems.push("Stock tracking is on but no stock level is set.");
  }
  return problems;
}

function auditRow(row: ContentSummary, domain: string, now: string): string[] {
  const problems = commonProblems(row, domain);
  if (domain === "events") {
    problems.push(...eventProblems(row, now));
  }
  if (domain === "benefits") {
    problems.push(...benefitProblems(row, now));
  }
  if (domain === "products") {
    problems.push(...productProblems(row));
  }
  return problems;
}

const DOMAIN_CHECKS: Record<string, string | null> = {
  events:
    "Published event whose end date has passed; paid event with no member price",
  benefits: "Published benefit past its publish window",
  products:
    "Published product with no sales type; tracked inventory with no stock level",
  news: null,
};

export const workflowsModule: ToolModule = {
  name: "workflows",
  title: "Composite workflows",
  description:
    "Deterministic, source-linked aggregations over several domains at once.",
  tools: [
    defineTool({
      name: "biso_campus_briefing",
      title: "Campus briefing",
      description:
        "A scoped snapshot of what needs attention: vacancies closing soon, events starting soon, unpublished drafts, pending approvals and unhandled submissions. Deterministic aggregation over your own scope — no model is involved, and every finding links to the item it came from.",
      inputSchema: {
        campusId: z
          .string()
          .optional()
          .describe(
            "Narrow to one campus. Can only intersect your own scope, never widen it."
          ),
        horizonDays: z
          .number()
          .int()
          .min(1)
          .max(90)
          .optional()
          .describe(
            "How far ahead to look for deadlines and events. Defaults to 14."
          ),
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        return isAnonymous(context.principal)
          ? "A briefing is scoped to a verified identity; none is configured."
          : true;
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const horizon = args.horizonDays ?? 14;
        const warnings: string[] = [];

        const findings = [
          ...(await collectUpcomingEvents(
            context,
            args.campusId,
            horizon,
            warnings
          )),
          ...(await collectStaleDrafts(context, args.campusId, warnings)),
          ...(await collectClosingVacancies(
            context,
            args.campusId,
            horizon,
            warnings
          )),
          ...(await collectInboxFindings(context, warnings)),
        ];

        const urgent = findings.filter(
          (finding) => finding.severity === "urgent"
        ).length;
        const scope = describeScope(context.principal);

        return result({
          requestId,
          summary:
            findings.length === 0
              ? `Nothing needs attention in the next ${horizon} days, within ${scope.summary.toLowerCase()}.`
              : `${findings.length} finding(s)${urgent > 0 ? `, ${urgent} urgent` : ""}, within ${scope.summary.toLowerCase()}, looking ${horizon} days ahead.`,
          data: {
            horizonDays: horizon,
            campusFilter: args.campusId
              ? campusLabel(args.campusId)
              : "your full scope",
            findings,
            method:
              "Deterministic aggregation of real queries. No language model was involved, and nothing here is inferred.",
          },
          scope,
          warnings: warnings.length > 0 ? warnings : undefined,
          links: { dashboard: context.links.admin("/") },
        });
      },
    }),

    defineTool({
      name: "biso_content_quality_audit",
      title: "Bilingual content quality audit",
      description:
        "Check content in your scope for problems static inspection can actually establish: a missing Norwegian or English translation, an event whose date has passed while still published, a published item with no slug. Deliberately narrow — it cannot judge translation quality, and it says nothing about accessibility, which needs a rendered page.",
      inputSchema: {
        domain: z
          .enum(["events", "news", "benefits", "products"])
          .describe("Which content type to audit."),
        campusId: z.string().optional().describe("Narrow to one campus id."),
        status: z
          .string()
          .optional()
          .describe(
            "Restrict to one status. Defaults to auditing every status in scope."
          ),
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        return isAnonymous(context.principal)
          ? "An audit is scoped to a verified identity; none is configured."
          : true;
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const found = await context.services.content.search(context.principal, {
          domain: args.domain,
          status: args.status,
          campusId: args.campusId,
          limit: AUDIT_LIMIT,
          offset: 0,
        });

        const now = new Date().toISOString();
        const issues: AuditIssue[] = [];

        for (const row of found.rows) {
          const problems = auditRow(row, args.domain, now);
          if (problems.length > 0) {
            issues.push({
              id: row.id,
              title: row.title ?? row.slug,
              problems,
              link: row.links.admin ?? null,
            });
          }
        }

        return result({
          requestId,
          summary:
            issues.length === 0
              ? `No issues found in ${found.rows.length} ${args.domain} item(s) checked.`
              : `${issues.length} of ${found.rows.length} ${args.domain} item(s) have issues.`,
          data: {
            checked: found.rows.length,
            issues,
            checksPerformed: [
              "Missing Norwegian or English translation",
              "Missing title or slug",
              DOMAIN_CHECKS[args.domain],
            ].filter(Boolean),
            notChecked: [
              "Translation quality or accuracy — this only checks that a translation row exists.",
              "Accessibility. Establishing that needs a rendered page; nothing here inspects rendered output.",
              "Whether internal links resolve, or whether referenced images exist.",
            ],
          },
          scope: found.scope,
          pagination: found.pagination,
          warnings:
            found.rows.length === AUDIT_LIMIT
              ? [
                  `Only the first ${AUDIT_LIMIT} items were audited. Narrow by campus or status for complete coverage.`,
                ]
              : found.warnings,
        });
      },
    }),
  ],
};
