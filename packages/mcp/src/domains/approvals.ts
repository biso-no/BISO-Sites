/**
 * Approvals and the inbox.
 *
 * Deciding an approval is deliberately absent. `approveRequest` in the admin
 * app does two things in one step: it flips the request row, and it *executes*
 * the publish the request describes. Splitting that across a model-driven tool
 * would mean this server performing a publish on behalf of an approver who
 * clicked nothing — the exact case the mutation model exists to prevent. The
 * tools here let an authorized person see what is waiting and file a new
 * request; the decision itself stays in the portal, where the approver is
 * present.
 */

import { z } from "zod";
import { campusLabel } from "../identity/campus";
import { isAnonymous } from "../identity/principal";
import { canPublishForCampus, describeScope } from "../identity/scope";
import { forbidden, notSupported } from "../runtime/errors";
import { defineTool, type ToolModule } from "../runtime/register";
import { buildPagination } from "../runtime/result";
import {
  APPROVAL_EXECUTION_NOTES,
  type ApprovalDomain,
  EXECUTABLE_APPROVAL_DOMAINS,
} from "../services/approvals";
import { type ContentDomain, domainSpec } from "../services/content-registry";
import { hasRecruitmentAccess } from "../services/recruitment";
import { proposalInput, proposeOrExecute } from "./content";
import {
  newRequestId,
  paginationInput,
  READ_ONLY,
  readPage,
  result,
  STAFF_PROFILES,
  WRITE_ADDITIVE,
} from "./shared";

/** `approval_requests.resource_type` values, keyed by content domain. */
const RESOURCE_TYPE: Record<ApprovalDomain, string> = {
  benefits: "benefit",
  documents: "document",
  events: "event",
  jobs: "job",
  news: "news",
  shop: "product",
};

/**
 * The portal-execution caveat for a domain, if it has one.
 *
 * Kept as a list so it slots straight into the result envelope's `warnings`,
 * and read from `APPROVAL_EXECUTION_NOTES` so the request tool and the
 * approver's queue can never disagree about which domains dead-end.
 */
function executionWarnings(domain: ApprovalDomain): string[] | undefined {
  const note = APPROVAL_EXECUTION_NOTES[domain];
  return note ? [note] : undefined;
}

export const approvalsModule: ToolModule = {
  name: "approvals",
  title: "Approvals and inbox",
  description:
    "See what is waiting for a decision, and route a publish you cannot perform yourself to the team that can.",
  tools: [
    defineTool({
      name: "biso_list_pending_approvals",
      title: "Pending approvals",
      description:
        "List approval requests waiting for your decision. Appwrite row permissions decide what you see: a request is visible to its named approver team and to the Operations Unit, so this returns exactly the portal's own inbox.",
      inputSchema: { ...paginationInput },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const { limit, offset } = readPage(args);
        const found = await context.services.approvals.listPending({
          limit,
          offset,
        });
        return result({
          requestId,
          summary:
            found.rows.length === 0
              ? "Nothing is waiting for your approval."
              : `${found.rows.length} pending approval request(s).`,
          data: {
            requests: found.rows,
            note: "Deciding a request is not available from this server: approving also executes the publish it describes, which needs the approver present. Use the admin portal's inbox.",
          },
          scope: describeScope(context.principal),
          pagination: buildPagination({
            count: found.rows.length,
            total: found.total,
            offset,
            limit,
          }),
          links: { inbox: context.links.admin("/inbox/approvals") },
        });
      },
    }),

    defineTool({
      name: "biso_get_approval_request",
      title: "Read an approval request",
      description:
        "Read one approval request: what it would publish, who filed it, which team must decide it, and its current status.",
      inputSchema: {
        requestId: z.string().min(1).describe("The approval_requests $id."),
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const outRequestId = newRequestId();
        const request = await context.services.approvals.get(args.requestId);
        return result({
          requestId: outRequestId,
          summary: `${request.action} on ${request.resourceType} ${request.resourceId ?? "(none)"} — ${request.status}, routed to ${request.approverTeamId}.`,
          data: request,
          scope: describeScope(context.principal),
          links: { inbox: context.links.admin("/inbox/approvals") },
        });
      },
    }),

    defineTool({
      name: "biso_request_approval",
      title: "Request a publish approval",
      description:
        "File an approval request to publish something you cannot publish yourself. Only publishing can be routed this way — the execution path behind approvals handles `<domain>.publish` and nothing else, so filing anything else would create a request nobody could act on. Routes to the campus management team, or to Operations Unit for vacancies.",
      inputSchema: {
        domain: z
          .enum(EXECUTABLE_APPROVAL_DOMAINS)
          .describe("Which content type would be published."),
        id: z.string().min(1).describe("The row $id to publish."),
        reason: z
          .string()
          .max(1000)
          .optional()
          .describe("Why this should be published. Shown to the approver."),
        ...proposalInput,
      },
      annotations: WRITE_ADDITIVE,
      tier: "draft",
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        if (isAnonymous(context.principal)) {
          return "No user credential is configured, so a request could not be attributed to a requester.";
        }
        if (!context.clients.hasElevated) {
          return "Filing an approval request needs the service key: `approval_requests` has no table-level create grant. Set BISO_MCP_APPWRITE_API_KEY.";
        }
        return true;
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const domain = args.domain as ApprovalDomain;

        // Recruitment is HR-exclusive with global-admin break-glass, and the
        // gate has to be here as well as on the content tools. `jobs` grants
        // `read("any")`, so an ordinary department member can read a vacancy in
        // their own department and would otherwise be able to file a persisted
        // `jobs.publish` request for it. The portal's approval executor checks
        // the *approver's* publish access, never the requester's role, so such
        // a request could then be approved by Operations Unit and enter the
        // recruitment workflow without HR ever sanctioning it.
        if (domain === "jobs" && !hasRecruitmentAccess(context.principal)) {
          throw forbidden(
            "Recruitment is restricted to HR, with global-admin break-glass.",
            { domain, id: args.id },
            "Ask HR to file this request. Filing it here would create an approval an approver could grant without any HR involvement."
          );
        }

        // `shop` is the approval vocabulary for what the content registry calls
        // `products`; map before reading the row.
        const contentDomain: ContentDomain =
          domain === "shop" ? "products" : (domain as ContentDomain);
        const item = await context.services.content.get(
          context.principal,
          contentDomain,
          args.id
        );

        if (canPublishForCampus(context.principal, item.campusId)) {
          throw notSupported(
            "You can publish this yourself, so an approval request would be redundant.",
            { domain, id: args.id, campusId: item.campusId }
          );
        }

        const payload = {
          domain,
          resourceId: args.id,
          resourceType: RESOURCE_TYPE[domain],
          campusId: item.campusId,
          departmentId: item.departmentId,
          payload: {
            id: args.id,
            title: item.title,
            reason: args.reason ?? null,
            requestedVia: "mcp",
          },
        };

        const outcome = await proposeOrExecute({
          context,
          action: `${domain}.request_approval`,
          tier: "draft",
          targets: [
            {
              table: "approval_requests",
              id: "(new)",
              label: `${domain}.publish ${args.id}`,
            },
            {
              table: domainSpec(contentDomain).table,
              id: args.id,
              label: item.title ?? args.id,
            },
          ],
          payload,
          revision: item.revision,
          token: args.proposalToken,
          expiresAt: args.proposalExpiresAt,
          confirmation: {
            title: "File approval request",
            message: `Ask the approver team to publish "${item.title ?? args.id}" in ${campusLabel(item.campusId)}.`,
          },
          execute: () =>
            context.services.approvals.create(context.principal, payload),
        });

        return result({
          requestId,
          summary: outcome.summary,
          effect: outcome.executed ? "executed" : "proposed",
          data: outcome.executed
            ? { filed: outcome.data, proposal: outcome.proposal }
            : { proposal: outcome.proposal },
          scope: describeScope(context.principal),
          links: item.links,
          // Filing succeeds; completing it may not. Say so here rather than
          // letting the requester discover it when the approver's click fails.
          warnings: executionWarnings(domain),
        });
      },
    }),

    defineTool({
      name: "biso_inbox_counts",
      title: "What needs my attention",
      description:
        "Count the approval requests and new form submissions waiting for you. A non-approver legitimately sees zeroes; the result says which case applies rather than implying the queues are empty.",
      inputSchema: {},
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(_args, context) {
        const requestId = newRequestId();
        const counts = await context.services.operations.inboxCounts(
          context.principal
        );
        return result({
          requestId,
          summary:
            counts.total === 0
              ? (counts.note ?? "Nothing is waiting for you.")
              : `${counts.total} item(s) waiting: ${counts.approvals} approval(s), ${counts.submissions} submission(s).`,
          data: counts,
          scope: describeScope(context.principal),
          links: { inbox: context.links.admin("/inbox") },
        });
      },
    }),

    defineTool({
      name: "biso_list_submissions",
      title: "Form submissions",
      description:
        "List contact-form submissions in your campus scope. Returns each submission's topic, status and the NAMES of its fields — never the submitted values, which are free text a visitor typed into a public form.",
      inputSchema: {
        status: z
          .enum(["new", "read", "actioned", "archived"])
          .optional()
          .describe("Filter by handling status."),
        topic: z.string().optional().describe("Filter by form topic."),
        ...paginationInput,
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const { limit, offset } = readPage(args);
        const found = await context.services.operations.submissions(
          context.principal,
          { status: args.status, topic: args.topic, limit, offset }
        );
        return result({
          requestId,
          summary: `${found.rows.length} submission(s)${args.status ? ` with status ${args.status}` : ""}.`,
          data: {
            submissions: found.rows,
            note: "Submitted values are not returned. Open the submission in the admin app to read them.",
          },
          scope: describeScope(context.principal),
          pagination: buildPagination({
            count: found.rows.length,
            total: found.total,
            offset,
            limit,
          }),
          links: { submissions: context.links.admin("/submissions") },
        });
      },
    }),
  ],
};
