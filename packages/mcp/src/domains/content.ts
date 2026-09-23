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
  PUBLISH_SCOPE_NOTE,
} from "../identity/scope";
import type { ToolContext } from "../runtime/context";
import {
  DomainError,
  forbidden,
  invalidInput,
  isTransportFailure,
  notSupported,
} from "../runtime/errors";
import {
  type AppliedProposal,
  asApplied,
  assertNotExpired,
  assertUnchangedAuthority,
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
import { DATE_FILTER_NOTE } from "../services/event-time";
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
      proposal: AppliedProposal<TPayload>;
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

  // Report what this call is about to touch before any of it can fail. The
  // dispatcher turns it into the `audit_logs` row's action, resource id and
  // resource type, which otherwise carry only the tool's name — indistinguish-
  // able between publishing one page and unpublishing another. Reported on the
  // propose path too: nothing is persisted for a proposal, but the stderr
  // record is written for every call and is the only attestation when the row
  // write fails.
  context.noteMutation?.({
    action: proposal.action,
    targets: proposal.targets,
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
    // The elicitation has no deadline of its own, so the proposal's may have
    // passed while the dialog sat open. A ten-minute grant that executes an
    // hour later is not the grant that was shown.
    assertNotExpired(input.expiresAt);
    // Nor is it the grant of a person whose access changed while they were
    // deciding. The dispatcher's forced refresh ran before this handler, which
    // covers every write except the one that then waits on a human.
    assertUnchangedAuthority(
      context.principal,
      await context.refreshPrincipal({ force: true }),
      input.action
    );
  }

  const data = await executeAndClassify(input.execute);
  // `asApplied`, never `proposal`: the proposal rebuilt at the top of this call
  // carries a token minted from a *fresh* expiry, which the registry has never
  // seen. Handing it back would re-authorize the change that was just made.
  return {
    executed: true,
    proposal: asApplied(proposal, { expiresAt: input.expiresAt }),
    data,
    summary: `Applied ${input.action}.`,
  };
}

/**
 * Run the write, and reclassify a lost outcome from *it* as uncertain.
 *
 * This is the only place that knows a write was dispatched, which is why the
 * classification lives here. The tool layer used to infer it from the tool's
 * tier instead, and a mutating handler does fallible reads first —
 * `biso_content_set_lifecycle` reads the row before proposing, even in
 * propose-only mode, where nothing is ever written. A timeout from that read
 * was reported as `external_uncertain`: "the write may have been applied, do
 * not retry". Both halves false, and the second actively unhelpful.
 *
 * Two failures here are genuinely unknown, and they are unknown for the same
 * reason — the request reached Appwrite and no answer came back:
 *
 * - a `timeout`, where the deadline in `@repo/api/runtime` expired, and
 * - a transport failure, where the connection dropped before the reply. That
 *   one arrives as a status-less `internal`, because no HTTP response existed
 *   to classify, and it is the more dangerous of the two: it reads like a
 *   plain failure, so a caller would reasonably propose the same change again
 *   and duplicate a draft or an approval whose first write did land.
 *
 * A 5xx is deliberately NOT in this set. There the backend answered, so the
 * failure is reported as a failure — telling a caller "do not retry" about a
 * write that definitively did not happen is its own kind of wrong.
 */
async function executeAndClassify<TResult>(
  execute: () => Promise<TResult>
): Promise<TResult> {
  try {
    return await execute();
  } catch (error) {
    const lostOutcome =
      error instanceof DomainError &&
      (error.code === "timeout" || isTransportFailure(error));
    if (lostOutcome) {
      const cause = error as DomainError;
      throw new DomainError(
        "external_uncertain",
        `${cause.message} The write may or may not have been applied.`,
        {
          details: cause.details,
          remedy:
            "Do not retry this proposal. Read the current state first, and only propose again if the change is still needed.",
          cause,
        }
      );
    }
    throw error;
  }
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

/**
 * The slug shape `biso_content_create_draft` accepts.
 *
 * Exported so `content-slug.test.ts` can assert the compatibility this tool
 * depends on: every slug the repo's own `generateSlug` produces must pass this
 * validator. A caller told to follow the canonical rule and then refused by
 * this schema would have no way forward.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
            `ISO date. For events this filters on start date; for everything else on last update. ${DATE_FILTER_NOTE}`
          ),
        ...localeInput,
        ...paginationInput,
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        // The registry withdraws reads for `pages` as well as writes, and the
        // reason is not cosmetic: the generic service neither projects nor
        // decodes `page_translations`, so dispatching one returns a null title
        // and no translations for a page that has both. Advertising the
        // withdrawal without enforcing it left the broken path reachable.
        assertDomainSupports(args.domain as ContentDomain, "search");
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
        "Read a single content item with its translations. For an item your campus/department scope covers, `raw` carries every non-sensitive column; for one you can see only because it is published, `raw` is null and `fields` carries the public columns. Returns a `revision` for use as `expectedRevision` on a later change. An item outside your scope reports as not found rather than forbidden, so an id cannot be probed for existence.",
      inputSchema: {
        domain: z.enum(CONTENT_DOMAINS).describe("Which content type."),
        id: z.string().min(1).describe("The row $id."),
      },
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        assertDomainSupports(args.domain as ContentDomain, "get");
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
          warnings: detail.warnings,
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
            SLUG_PATTERN,
            "Lowercase letters, digits and single hyphens only."
          )
          .describe(
            "URL slug, e.g. `velkomstfest-oslo-2026`. Non-ASCII letters fold to their ASCII base rather than being dropped — `Høstball` becomes `hostball`, not `hstball` — which is what `generateSlug` in `@repo/shared/utils/content-slug` does for every other BISO surface."
          ),
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
      description: `Change a content item's publication state. \`publish\` makes it publicly visible, \`unpublish\` returns it to draft, \`archive\` retires it. Support varies by domain — call \`biso_list_capabilities\` first. ${PUBLISH_SCOPE_NOTE} Routing it to the approver team with \`biso_request_approval\` instead is a process choice, not a way past a refusal.`,
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
