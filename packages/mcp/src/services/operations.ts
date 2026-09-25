/**
 * Operational reads: inbox counts, integration configuration, submissions.
 *
 * One honesty rule runs through this module. The admin assistant's
 * `getOpsHealth` calls `checkIntegrationHealth((key) => Boolean(process.env[key]?.trim()))`
 * — it checks that environment variables are *present*, in the admin app's own
 * process, and reports the result as "integration health". Configuration
 * completeness is not reachability: a Vipps key that is set but revoked reports
 * healthy, and so does a SharePoint tenant that is set but unreachable.
 *
 * So the field here is called `configuration`, never `health`, every entry says
 * `configured` / `not configured` rather than `up` / `down`, and the result
 * carries an explicit note that nothing was contacted. A bounded live
 * connectivity probe is a separate, clearly-labelled capability and is on the
 * roadmap, not in this release.
 */

import { Query } from "@repo/api";
import type { BackendClients } from "../appwrite/clients";
import type { Principal } from "../identity/principal";
import { isCampusAdmin, isGlobalAdmin } from "../identity/principal";
import { approverTeamsFor, scopeQueries } from "../identity/scope";
import { fromAppwriteError } from "../runtime/errors";
import type { Projected } from "./row";

export interface InboxCounts {
  approvals: number;
  /**
   * True when either half hit `INBOX_COUNT_CEILING`, so the numbers are a
   * floor rather than an exact count. Callers must not render a capped count
   * as a plain figure.
   */
  atLeast: boolean;
  /** Non-approvers legitimately see zeroes; say so rather than implying empty. */
  note: string | null;
  submissions: number;
  total: number;
}

export interface SubmissionSummary {
  campusId: string | null;
  createdAt: string;
  /** Field names only. Submitted values are not returned by the listing. */
  fieldNames: string[];
  formHeading: string | null;
  id: string;
  status: string;
  topic: string;
}

export interface IntegrationConfiguration {
  configured: boolean;
  missing: string[];
  name: string;
  /** Which variables this integration needs; values are never read out. */
  requires: string[];
}

export interface OperationsService {
  /**
   * `campusId` narrows the counts; it can only intersect the principal's own
   * scope, never widen it. A caller that reports a campus filter to its user
   * has to pass it here too, or the numbers describe a wider scope than the
   * label says they do.
   */
  inboxCounts(
    principal: Principal,
    options?: { campusId?: string }
  ): Promise<InboxCounts>;
  integrationConfiguration(): IntegrationConfiguration[];
  submissions(
    principal: Principal,
    input: { status?: string; topic?: string; limit: number; offset: number }
  ): Promise<{ rows: SubmissionSummary[]; total: number }>;
}

/**
 * Which environment variables each integration needs.
 *
 * Read from this process's own environment, which is a real limitation: this
 * server is not the admin app, so a variable set for the apps and not for this
 * process reports as missing. The result says so.
 */
const INTEGRATION_REQUIREMENTS: ReadonlyArray<{
  name: string;
  requires: readonly string[];
}> = [
  {
    name: "Microsoft Graph (M365)",
    requires: [
      "AZURE_GRAPH_TENANT_ID",
      "AZURE_GRAPH_CLIENT_ID",
      "AZURE_GRAPH_CLIENT_SECRET",
    ],
  },
  {
    name: "SharePoint",
    requires: [
      "SHAREPOINT_TENANT_ID",
      "SHAREPOINT_CLIENT_ID",
      "SHAREPOINT_CLIENT_SECRET",
    ],
  },
  {
    name: "Vipps MobilePay",
    requires: [
      "VIPPS_CLIENT_ID",
      "VIPPS_CLIENT_SECRET",
      "VIPPS_SUBSCRIPTION_KEY",
      "VIPPS_MERCHANT_SERIAL_NUMBER",
    ],
  },
  { name: "Stripe", requires: ["STRIPE_SECRET_KEY"] },
  {
    name: "24SevenOffice (SOAP)",
    requires: ["TFSO_APP_ID", "TFSO_USERNAME", "TFSO_PASSWORD"],
  },
  {
    name: "Finago (24SO REST)",
    requires: [
      "TFSO_REST_CLIENT_ID",
      "TFSO_REST_CLIENT_SECRET",
      "TFSO_REST_ORG_ID",
    ],
  },
  { name: "SMTP", requires: ["SMTP_HOST", "SMTP_FROM"] },
  { name: "Umami analytics", requires: ["UMAMI_API_URL", "UMAMI_USERNAME"] },
];

/**
 * How many inbox rows either half will count before reporting a floor.
 *
 * One request per half, `$id` only. Chosen to be far above a real decision
 * queue — an inbox this size is a backlog to escalate, not a number to render
 * precisely — so `atLeast` stays false in practice while the request stays
 * bounded. Deliberately not a cursor walk: an unbounded scan to produce one
 * headline figure is the kind of thing this package refuses to do elsewhere.
 */
const INBOX_COUNT_CEILING = 500;

/** Rows from one settled half of the inbox count; a rejected half counts zero. */
function settledCount(
  settled: PromiseSettledResult<{ rows: unknown[] }>
): number {
  return settled.status === "fulfilled" ? settled.value.rows.length : 0;
}

/**
 * What the caller is told about the numbers themselves.
 *
 * A failed half outranks a capped one: "one of these is missing" is worse news
 * than "this one is a floor", and reporting only the cap would imply both
 * halves were read.
 */
function inboxNote(failed: boolean, atLeast: boolean): string | null {
  if (failed) {
    return "At least one count could not be read and is reported as 0.";
  }
  if (atLeast) {
    return `More than ${INBOX_COUNT_CEILING} items are waiting; the counts are a floor, not an exact figure.`;
  }
  return null;
}

export function createOperationsService(
  clients: BackendClients,
  env: Record<string, string | undefined> = process.env
): OperationsService {
  return {
    async inboxCounts(principal, options) {
      // Two different eligibilities, previously collapsed into one gate.
      //
      // Approvals are routed by `approver_team_id`, so who can decide one is
      // `approverTeamsFor` — the same answer `listPending` uses, which is the
      // point: the count and the list must not disagree about the same rows.
      // That check now carries the portal's own role gate as well, so an
      // Operations Unit member who holds neither admin role counts zero here
      // and sees an empty queue there, which is what `approveRequest` will
      // tell them.
      //
      // Submissions have no approver column and are routed by campus scope, so
      // that half keeps the admin check.
      const deciderTeams = approverTeamsFor(principal);
      const canDecide = deciderTeams === null || deciderTeams.length > 0;
      const seesSubmissions =
        isGlobalAdmin(principal) || isCampusAdmin(principal);
      if (!(canDecide || seesSubmissions)) {
        return {
          approvals: 0,
          atLeast: false,
          submissions: 0,
          total: 0,
          note: "You hold no approver team and are not a campus or global admin, so nothing is routed to you.",
        };
      }

      // Applied on top of the principal's own scope, never instead of it, so a
      // caller naming another campus gets zero rather than that campus's count.
      // Both tables carry `campus_id`.
      const campusFilter = options?.campusId
        ? [Query.equal("campus_id", [options.campusId])]
        : [];

      // The same decider filter `ApprovalService.listPending` applies, and for
      // the same reason: `approval_requests` has no table-level permissions, so
      // row security is the only grant — and it grants the *requester* read on
      // their own rows. Counting on visibility alone therefore reports a
      // caller's own requests, routed to a team they are not in, as work
      // waiting for their decision. `null` is the Operations Unit override (no
      // honest team filter exists for them); `[]` is a principal with no teams,
      // who can decide nothing.
      const approverFilter = deciderTeams
        ? [Query.equal("approver_team_id", deciderTeams)]
        : [];

      // Counted from the rows, not from `listRows(...).total`.
      //
      // This used to read `total` off a `Query.limit(1)` call, on the premise
      // that Appwrite reports the full match count regardless of page size.
      // That premise is now disputed: `apps/web/src/lib/data/queries.ts`
      // (`countRows`) states that since the Appwrite release this repo is on,
      // `total` reports the size of the whole table rather than of the
      // filtered result, and stopped using it for the homepage counters for
      // exactly that reason. I could not confirm or refute that against
      // Appwrite's release notes, and the repo has not adopted the rule
      // everywhere — `apps/admin`'s own inbox still reads `total`.
      //
      // So this does not take a side. Counting returned rows is correct under
      // either reading, because only `total` is in question and never which
      // rows come back — the same assumption `countRows` itself rests on. The
      // cost is one bounded request per half with an `$id`-only projection,
      // and the ceiling is reported rather than silently truncating.
      const [approvals, submissions] = await Promise.allSettled([
        canDecide
          ? clients.user.db.listRows("app", "approval_requests", [
              Query.equal("status", "pending"),
              ...approverFilter,
              Query.select(["$id"]),
              Query.limit(INBOX_COUNT_CEILING),
              ...campusFilter,
            ])
          : Promise.resolve({ rows: [] }),
        seesSubmissions
          ? clients.user.db.listRows("app", "form_submissions", [
              Query.equal("status", "new"),
              Query.select(["$id"]),
              Query.limit(INBOX_COUNT_CEILING),
              // `form_submissions` is campus-scoped only; it has no department
              // column, so a department-only principal fails closed here.
              ...scopeQueries(principal, { departmentField: null }),
              ...campusFilter,
            ])
          : Promise.resolve({ rows: [] }),
      ]);

      const approvalCount = settledCount(approvals);
      const submissionCount = settledCount(submissions);
      const atLeast =
        approvalCount === INBOX_COUNT_CEILING ||
        submissionCount === INBOX_COUNT_CEILING;
      const failed =
        approvals.status === "rejected" || submissions.status === "rejected";

      return {
        approvals: approvalCount,
        atLeast,
        submissions: submissionCount,
        total: approvalCount + submissionCount,
        note: inboxNote(failed, atLeast),
      };
    },

    async submissions(principal, input) {
      const queries: string[] = [
        ...scopeQueries(principal, { departmentField: null }),
        Query.orderDesc("$createdAt"),
        Query.limit(input.limit),
        Query.offset(input.offset),
      ];
      if (input.status) {
        queries.push(Query.equal("status", input.status));
      }
      if (input.topic) {
        queries.push(Query.equal("topic", input.topic));
      }

      try {
        const result = await clients.user.db.listRows<
          Projected<{
            topic: string;
            form_heading: string | null;
            status: string;
            campus_id: string | null;
            data_json: string;
          }>
        >("app", "form_submissions", queries);

        return {
          rows: result.rows.map((row) => ({
            id: row.$id,
            topic: row.topic,
            formHeading: row.form_heading,
            status: row.status,
            campusId: row.campus_id,
            createdAt: row.$createdAt,
            // Field NAMES only. A submission body is whatever a visitor typed
            // into a public form; listing it would put arbitrary personal data
            // into a model's context for every row, on every listing.
            fieldNames: fieldNamesOf(row.data_json),
          })),
          total: result.total,
        };
      } catch (error) {
        throw fromAppwriteError(error, { operation: "list submissions" });
      }
    },

    integrationConfiguration() {
      return INTEGRATION_REQUIREMENTS.map((integration) => {
        const missing = integration.requires.filter((key) => !env[key]?.trim());
        return {
          name: integration.name,
          configured: missing.length === 0,
          requires: [...integration.requires],
          missing,
        };
      });
    },
  };
}

function fieldNamesOf(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return Object.keys(parsed as Record<string, unknown>);
    }
  } catch {
    // A malformed body is reported as having no readable fields rather than
    // failing the whole listing.
  }
  return [];
}
