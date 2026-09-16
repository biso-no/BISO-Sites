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

export function createOperationsService(
  clients: BackendClients,
  env: Record<string, string | undefined> = process.env
): OperationsService {
  return {
    async inboxCounts(principal, options) {
      // Two different eligibilities, previously collapsed into one gate.
      //
      // Approvals are routed by `approver_team_id`, so who can decide one is
      // `approverTeamsFor` — the same answer `listPending` uses. That includes
      // the Operations Unit override, and an Operations Unit member who does
      // not also hold the National campus team is neither a global nor a campus
      // admin: `deriveRoles` requires both. The old gate reported zero to
      // exactly those people while `biso_list_pending_approvals` showed them
      // the rows.
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

      // `Query.limit(1)` with `result.total`: Appwrite reports the full match
      // count regardless of page size, so one row is enough to count them.
      const [approvals, submissions] = await Promise.allSettled([
        canDecide
          ? clients.user.db.listRows("app", "approval_requests", [
              Query.equal("status", "pending"),
              ...approverFilter,
              Query.limit(1),
              ...campusFilter,
            ])
          : Promise.resolve({ total: 0 }),
        seesSubmissions
          ? clients.user.db.listRows("app", "form_submissions", [
              Query.equal("status", "new"),
              Query.limit(1),
              // `form_submissions` is campus-scoped only; it has no department
              // column, so a department-only principal fails closed here.
              ...scopeQueries(principal, { departmentField: null }),
              ...campusFilter,
            ])
          : Promise.resolve({ total: 0 }),
      ]);

      const approvalCount =
        approvals.status === "fulfilled" ? approvals.value.total : 0;
      const submissionCount =
        submissions.status === "fulfilled" ? submissions.value.total : 0;
      const failed =
        approvals.status === "rejected" || submissions.status === "rejected";

      return {
        approvals: approvalCount,
        submissions: submissionCount,
        total: approvalCount + submissionCount,
        note: failed
          ? "At least one count could not be read and is reported as 0."
          : null,
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
