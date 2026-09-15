/**
 * Scoped content operations.
 *
 * Reads are the direct replacement for the admin assistant's `searchContent` /
 * `getContent`, with the semantics its route adapter loses (see
 * `services/content.ts`).
 *
 * Writes follow the proposal model in `runtime/mutation.ts`. Every mutating
 * tool takes the same two optional arguments — `proposalToken` and
 * `proposalExpiresAt` — and behaves the same way: without them it validates,
 * authorizes and returns a proposal; with them it verifies the token against
 * the current call's own action, actor, payload and revision, and only then it
 * writes. A token from one proposal cannot authorize a different change.
 */

import { z } from "zod";
import { campusLabel } from "../identity/campus";
import { isAnonymous } from "../identity/principal";
import {
  assertPublishAccess,
  assertWriteAccess,
  describeScope,
} from "../identity/scope";
import type { ToolContext } from "../runtime/context";
import { forbidden, invalidInput, notSupported } from "../runtime/errors";
import {
  createProposal,
  type MutationProposal,
  verifyProposalToken,
} from "../runtime/mutation";
import { defineTool, type ToolModule } from "../runtime/register";
import {
  CONTENT_DOMAINS,
  type ContentDomain,
  domainSpec,
  domainsSupporting,
  supports,
  unsupportedReason,
} from "../services/content-registry";
import { hasRecruitmentAccess } from "../services/recruitment";
import {
  localeInput,
  newRequestId,
  paginationInput,
  READ_ONLY,
  readPage,
  result,
  STAFF_PROFILES,
  WRITE_ADDITIVE,
  WRITE_IDEMPOTENT,
} from "./shared";

/** The two arguments every mutating tool shares. */
const proposalInput = {
  proposalToken: z
    .string()
    .optional()
    .describe(
      "The `token` from a proposal returned by this same tool. Omit it to get a proposal; pass it back verbatim (with `proposalExpiresAt`) to execute that exact change. A token authorizes one payload, for one actor, at one revision."
    ),
  proposalExpiresAt: z
    .string()
    .optional()
    .describe(
      "The `expiresAt` from the same proposal. Required with `proposalToken`."
    ),
};

const LIFECYCLE_TRANSITIONS = ["publish", "unpublish", "archive"] as const;
type LifecycleTransition = (typeof LIFECYCLE_TRANSITIONS)[number];

/**
 * Run the shared proposal/execute cycle.
 *
 * `buildProposal` must be pure enough to run twice with the same result: it is
 * called once to produce the proposal and again, on execution, to recompute the
 * token inputs. That is what makes the token bind to the change rather than to
 * the fact that a proposal once existed.
 */
async function proposeOrExecute<TPayload, TResult>(input: {
  context: ToolContext;
  action: string;
  tier: MutationProposal["tier"];
  targets: MutationProposal["targets"];
  payload: TPayload;
  diff?: MutationProposal["diff"];
  revision: string | null;
  token?: string;
  expiresAt?: string;
  /** Short sentence shown in the human confirmation prompt. */
  confirmation: { title: string; message: string };
  execute: () => Promise<TResult>;
}): Promise<
  | { executed: false; proposal: MutationProposal<TPayload>; summary: string }
  | {
      executed: true;
      proposal: MutationProposal<TPayload>;
      data: TResult;
      summary: string;
    }
> {
  const { context } = input;
  const proposal = createProposal({
    action: input.action,
    tier: input.tier,
    targets: input.targets,
    payload: input.payload,
    diff: input.diff,
    revision: input.revision,
    principal: context.principal,
    options: context.mutation,
  });

  if (!input.token) {
    return {
      executed: false,
      proposal,
      summary: proposal.execution.executable
        ? `Prepared ${input.action}. Nothing was written. Call this tool again with the returned proposalToken and proposalExpiresAt to apply it.`
        : `Prepared ${input.action}. ${proposal.execution.reason}`,
    };
  }

  if (!input.expiresAt) {
    throw invalidInput(
      "`proposalExpiresAt` is required when `proposalToken` is supplied.",
      { action: input.action }
    );
  }

  if (!proposal.execution.executable) {
    throw forbidden(
      `This server cannot execute ${input.action}.`,
      { action: input.action, tier: input.tier },
      proposal.execution.reason
    );
  }

  verifyProposalToken({
    token: input.token,
    serverSecret: context.mutation.serverSecret,
    actorId: context.principal.userId,
    action: input.action,
    payload: input.payload,
    revision: input.revision,
    expiresAt: input.expiresAt,
  });

  // Spend the proposal before anything is written. A token that verifies is
  // still only good for one execution: `createDraft` and `requestApproval`
  // mint a fresh id each time, so a replay would create a row nobody proposed.
  // Consuming first also means a write whose outcome is unknown — a timeout,
  // a dropped connection — cannot be blindly retried into a duplicate.
  context.mutation.proposals.consume(input.token, input.expiresAt);

  // In `confirm` mode a human must accept before anything is written. The
  // elicitation is the only thing in this flow the model cannot produce itself.
  if (context.mutation.writeMode === "confirm") {
    const accepted = await context.confirmWithHuman(input.confirmation);
    if (!accepted) {
      throw forbidden(
        "The change was not confirmed.",
        { action: input.action },
        "The user declined, dismissed, or the client could not present the confirmation. Nothing was written."
      );
    }
  }

  const data = await input.execute();
  return {
    executed: true,
    proposal,
    data,
    summary: `Applied ${input.action}.`,
  };
}

function assertDomainSupports(
  domain: ContentDomain,
  operation: Parameters<typeof supports>[1]
): void {
  if (!supports(domain, operation)) {
    throw notSupported(unsupportedReason(domain, operation), {
      domain,
      operation,
    });
  }
}

/** The status a lifecycle transition moves a row to, or null if it has none. */
function statusForTransition(
  spec: ReturnType<typeof domainSpec>,
  transition: LifecycleTransition
): string | null {
  if (transition === "publish") {
    return spec.publishedStatus;
  }
  if (transition === "unpublish") {
    return spec.draftStatus;
  }
  return spec.archivedStatus;
}

/** Recruitment is HR-exclusive; general content access does not reach it. */
function assertRecruitmentGate(
  domain: ContentDomain,
  context: ToolContext
): void {
  if (domain === "jobs" && !hasRecruitmentAccess(context.principal)) {
    throw forbidden(
      "Vacancies are restricted to HR and global admins.",
      { yourDepartments: context.principal.departmentNames },
      "This differs from general content, which is open to any department member."
    );
  }
}

export const contentModule: ToolModule = {
  name: "content",
  title: "Content operations",
  description:
    "Scoped search, read and lifecycle operations across the content domains, with a per-domain support matrix rather than blanket CRUD.",
  tools: [
    defineTool({
      name: "biso_content_search",
      title: "Search content",
      description:
        "Search content you have access to, scoped automatically to your campuses and departments. Unlike the admin assistant's equivalent, the free-text term applies to every domain, `limit` is honoured, results are paginated, and every result reports the scope it was filtered to — so an empty list is distinguishable from 'nothing exists'.",
      inputSchema: {
        domain: z
          .enum(CONTENT_DOMAINS)
          .describe("Which content type to search."),
        query: z
          .string()
          .optional()
          .describe(
            "Free-text term matched against titles and descriptions (via content_translations where the domain uses them)."
          ),
        status: z
          .string()
          .optional()
          .describe(
            "Status filter. Valid values differ by domain — `biso_list_capabilities` lists them. An invalid value is reported as a warning rather than silently ignored."
          ),
        campusId: z
          .string()
          .optional()
          .describe(
            "Narrow to one campus. This can only intersect your own scope, never widen it."
          ),
        departmentId: z
          .string()
          .optional()
          .describe("Narrow to one department id."),
        updatedSince: z
          .string()
          .optional()
          .describe(
            "ISO date. For events this filters on start date; for everything else on last update."
          ),
        ...localeInput,
        ...paginationInput,
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        assertRecruitmentGate(args.domain as ContentDomain, context);
        const { limit, offset } = readPage(args);

        const found = await context.services.content.search(context.principal, {
          domain: args.domain as ContentDomain,
          query: args.query,
          status: args.status,
          campusId: args.campusId,
          departmentId: args.departmentId,
          locale: args.locale,
          updatedSince: args.updatedSince,
          limit,
          offset,
        });

        return result({
          requestId,
          summary:
            found.rows.length === 0
              ? `No ${args.domain} match, within ${found.scope.summary.toLowerCase()}.`
              : `${found.rows.length} ${args.domain}${found.pagination.total && found.pagination.total > found.rows.length ? ` of ${found.pagination.total}` : ""}, within ${found.scope.summary.toLowerCase()}.`,
          data: { items: found.rows },
          scope: found.scope,
          pagination: found.pagination,
          warnings: found.warnings.length > 0 ? found.warnings : undefined,
        });
      },
    }),

    defineTool({
      name: "biso_content_get",
      title: "Read one content item",
      description:
        "Read a single content item with its translations and every non-sensitive column. Returns a `revision` for use as `expectedRevision` on a later change. An item outside your scope reports as not found rather than forbidden, so an id cannot be probed for existence.",
      inputSchema: {
        domain: z.enum(CONTENT_DOMAINS).describe("Which content type."),
        id: z.string().min(1).describe("The row $id."),
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        assertRecruitmentGate(args.domain as ContentDomain, context);
        const detail = await context.services.content.get(
          context.principal,
          args.domain as ContentDomain,
          args.id
        );
        return result({
          requestId,
          summary: `${args.domain} "${detail.title ?? detail.slug ?? detail.id}" — status ${detail.status}, ${campusLabel(detail.campusId)}.`,
          data: detail,
          scope: describeScope(context.principal),
          links: detail.links,
        });
      },
    }),

    defineTool({
      name: "biso_content_create_draft",
      title: "Create a content draft",
      description:
        "Create a new DRAFT news article or event with Norwegian and English text. The row is created unpublished with no public read permission — publishing is a separate, separately-authorized step. Supported domains: " +
        domainsSupporting("create_draft").join(", ") +
        ". Without a proposalToken this returns a validated proposal and writes nothing.",
      inputSchema: {
        domain: z
          .enum(["news", "events"])
          .describe("The content type to draft."),
        slug: z
          .string()
          .min(1)
          .max(200)
          .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Lowercase letters, digits and single hyphens only."
          )
          .describe("URL slug, e.g. `velkomstfest-oslo-2026`."),
        campusId: z
          .string()
          .min(1)
          .describe("Numeric campus id the content belongs to."),
        departmentId: z
          .string()
          .optional()
          .describe(
            "Owning department id. Required if you are a department member rather than a campus or global admin."
          ),
        titleNo: z.string().min(1).max(500).describe("Norwegian title."),
        titleEn: z.string().min(1).max(500).describe("English title."),
        descriptionNo: z
          .string()
          .min(1)
          .max(8000)
          .describe("Norwegian body text (markdown)."),
        descriptionEn: z
          .string()
          .min(1)
          .max(8000)
          .describe("English body text (markdown)."),
        ...proposalInput,
      },
      annotations: WRITE_ADDITIVE,
      tier: "draft",
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        if (isAnonymous(context.principal)) {
          return "No user credential is configured, so a draft could not be attributed to an author.";
        }
        if (!context.clients.hasElevated) {
          return "Creating content needs the service key (content tables grant no per-team create for every campus). Set BISO_MCP_APPWRITE_API_KEY.";
        }
        return true;
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const domain = args.domain as ContentDomain;
        assertDomainSupports(domain, "create_draft");

        // Authorize the requested ownership before anything else. The campus
        // and department in the arguments are untrusted; this is what stops a
        // department member filing content under another department.
        assertWriteAccess(
          context.principal,
          args.campusId,
          args.departmentId ?? null
        );

        const payload = {
          domain,
          slug: args.slug,
          campusId: args.campusId,
          departmentId: args.departmentId ?? null,
          translations: [
            {
              locale: "no" as const,
              title: args.titleNo,
              description: args.descriptionNo,
            },
            {
              locale: "en" as const,
              title: args.titleEn,
              description: args.descriptionEn,
            },
          ],
        };

        const outcome = await proposeOrExecute({
          context,
          action: `${domain}.create_draft`,
          tier: "draft",
          targets: [
            { table: domainSpec(domain).table, id: "(new)", label: args.slug },
          ],
          payload,
          revision: null,
          token: args.proposalToken,
          expiresAt: args.proposalExpiresAt,
          confirmation: {
            title: `Create ${domain} draft`,
            message: `Create a new unpublished ${domain} "${args.titleNo}" (slug ${args.slug}) in ${campusLabel(args.campusId)}.`,
          },
          execute: () =>
            context.services.content.createDraft(context.principal, payload),
        });

        return result({
          requestId,
          summary: outcome.summary,
          effect: outcome.executed ? "executed" : "proposed",
          data: outcome.executed
            ? { created: outcome.data, proposal: outcome.proposal }
            : { proposal: outcome.proposal },
          scope: describeScope(context.principal),
        });
      },
    }),

    defineTool({
      name: "biso_content_set_lifecycle",
      title: "Publish, unpublish or archive",
      description:
        "Change a content item's publication state. `publish` makes it publicly visible, `unpublish` returns it to draft, `archive` retires it. Support varies by domain — call `biso_list_capabilities` first. Publishing requires campus-admin or global-admin scope for the item's campus; a department member who cannot publish directly can route it with `biso_request_approval`.",
      inputSchema: {
        domain: z.enum(CONTENT_DOMAINS).describe("Which content type."),
        id: z.string().min(1).describe("The row $id."),
        transition: z
          .enum(LIFECYCLE_TRANSITIONS)
          .describe("`publish`, `unpublish` or `archive`."),
        expectedRevision: z
          .string()
          .optional()
          .describe(
            "The `revision` from `biso_content_get`. When supplied, the change is refused if the item has since changed."
          ),
        ...proposalInput,
      },
      annotations: WRITE_IDEMPOTENT,
      tier: "publish",
      profiles: STAFF_PROFILES,
      isAvailable(context) {
        if (isAnonymous(context.principal)) {
          return "No user credential is configured.";
        }
        if (!context.clients.hasElevated) {
          return "Changing publication state needs the service key: content rows grant no team-level update, by design (`buildContentRowPermissions`). Set BISO_MCP_APPWRITE_API_KEY.";
        }
        return true;
      },
      async handler(args, context) {
        const requestId = newRequestId();
        const domain = args.domain as ContentDomain;
        const transition = args.transition as LifecycleTransition;
        const spec = domainSpec(domain);

        assertRecruitmentGate(domain, context);
        assertDomainSupports(domain, transition);

        const targetStatus = statusForTransition(spec, transition);

        if (!targetStatus) {
          throw notSupported(
            `${domain} has no status to ${transition} to (valid statuses: ${spec.statuses.join(", ")}).`,
            { domain, transition }
          );
        }

        // Read first: authorization runs on the item's real current ownership.
        const current = await context.services.content.get(
          context.principal,
          domain,
          args.id
        );

        if (transition === "publish") {
          assertPublishAccess(
            context.principal,
            current.campusId,
            current.departmentId
          );
        } else {
          assertWriteAccess(
            context.principal,
            current.campusId,
            current.departmentId
          );
        }

        const revision = args.expectedRevision ?? current.revision;
        const payload = { domain, id: args.id, status: targetStatus };

        const outcome = await proposeOrExecute({
          context,
          action: `${domain}.${transition}`,
          tier: "publish",
          targets: [
            {
              table: spec.table,
              id: args.id,
              label: current.title ?? current.slug ?? args.id,
            },
          ],
          payload,
          diff: [
            { path: "status", before: current.status, after: targetStatus },
          ],
          revision,
          token: args.proposalToken,
          expiresAt: args.proposalExpiresAt,
          confirmation: {
            title: `${transition} ${domain}`,
            message: `${transition} "${current.title ?? args.id}" in ${campusLabel(current.campusId)} — status ${current.status} → ${targetStatus}.`,
          },
          execute: () =>
            context.services.content.setStatus(
              context.principal,
              domain,
              args.id,
              targetStatus,
              revision
            ),
        });

        return result({
          requestId,
          summary: outcome.summary,
          effect: outcome.executed ? "executed" : "proposed",
          data: outcome.executed
            ? { applied: outcome.data, proposal: outcome.proposal }
            : {
                proposal: outcome.proposal,
                current: { status: current.status },
              },
          scope: describeScope(context.principal),
          links: current.links,
        });
      },
    }),
  ],
};

/** Exported for the pages and approvals modules, which share the proposal cycle. */
export { proposalInput, proposeOrExecute };
