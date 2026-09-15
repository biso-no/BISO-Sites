/**
 * Identity, capabilities and lookups.
 *
 * The first thing a model should call. `biso_whoami` answers "who am I and
 * what may I do", which is the question every subsequent refusal refers back
 * to, and `biso_explain_permission` answers "why was that refused" without
 * disclosing anything about other people's memberships.
 */

import { z } from "zod";
import { describeConfig } from "../config/env";
import { CAMPUS_NAME_TO_ID, campusLabel } from "../identity/campus";
import type { Principal } from "../identity/principal";
import {
  describePrincipal,
  hasDepartmentMembership,
  isAnonymous,
  isCampusAdmin,
  isGlobalAdmin,
  isHr,
} from "../identity/principal";
import { describeScope } from "../identity/scope";
import { invalidInput } from "../runtime/errors";
import { defineTool, type ToolModule } from "../runtime/register";
import { PUBLIC_SCOPE } from "../runtime/result";
import {
  CONTENT_DOMAINS,
  CONTENT_OPERATIONS,
  type ContentDomain,
  type ContentOperation,
  supportMatrix,
  supports,
  unsupportedReason,
} from "../services/content-registry";
import { hasRecruitmentAccess } from "../services/recruitment";
import {
  ALL_PROFILES,
  newRequestId,
  READ_ONLY,
  result,
  STAFF_PROFILES,
} from "./shared";

interface PermissionDecision {
  allowed: boolean;
  reasons: string[];
}

interface PermissionQuery {
  campusId?: string;
  departmentId?: string;
  domain: ContentDomain;
  operation: ContentOperation;
  principal: Principal;
}

/** Whether the caller's scope permits a write-shaped operation on this target. */
function decideScope(query: PermissionQuery): PermissionDecision {
  const { principal, campusId, departmentId } = query;

  if (isGlobalAdmin(principal)) {
    return {
      allowed: true,
      reasons: [
        "You are a global admin, so campus scope does not restrict you.",
      ],
    };
  }

  if (isCampusAdmin(principal)) {
    if (campusId && !principal.managedCampusIds.includes(campusId)) {
      return {
        allowed: false,
        reasons: [
          `You manage ${principal.managedCampuses.join(", ")}, not ${campusLabel(campusId)}.`,
        ],
      };
    }
    return {
      allowed: true,
      reasons: [
        `You are a campus admin for ${principal.managedCampuses.join(", ")}.`,
      ],
    };
  }

  if (hasDepartmentMembership(principal)) {
    if (!departmentId) {
      return {
        allowed: false,
        reasons: [
          "As a department member you can only act on content owned by your own department, so the target department must be named.",
        ],
      };
    }
    if (!principal.resolvedDepartmentIds.includes(departmentId)) {
      return {
        allowed: false,
        reasons: [
          "That department is not one of yours. Content is writable by the department that owns it, that campus's management team, or a global admin.",
        ],
      };
    }
    return {
      allowed: true,
      reasons: [`You are a member of ${principal.departmentNames.join(", ")}.`],
    };
  }

  return {
    allowed: false,
    reasons: [
      "You hold no campus-admin or department membership, so you have no write scope.",
    ],
  };
}

/**
 * Decide, and explain, whether an operation is permitted.
 *
 * Split out of the tool handler so each rule reads on its own: support, then
 * identity, then the recruitment gate, then scope.
 */
function decidePermission(query: PermissionQuery): PermissionDecision {
  const { principal, domain, operation } = query;
  const reasons: string[] = [];
  let allowed = true;

  if (!supports(domain, operation)) {
    allowed = false;
    reasons.push(
      `This server does not implement \`${operation}\` for ${domain}: ${unsupportedReason(domain, operation)}`
    );
  }

  if (isAnonymous(principal)) {
    return {
      allowed: false,
      reasons: [
        ...reasons,
        "No user credential is configured, so there is no identity to authorize.",
      ],
    };
  }

  if (domain === "jobs" && !hasRecruitmentAccess(principal)) {
    return {
      allowed: false,
      reasons: [
        ...reasons,
        "Recruitment is HR-exclusive with global-admin break-glass. General content access does not extend to vacancies or applicants.",
      ],
    };
  }

  // Reads are scoped by the query rather than refused, so only write-shaped
  // operations consult the scope rules.
  if (operation === "search" || operation === "get") {
    return { allowed, reasons };
  }

  const scopeDecision = decideScope(query);
  return {
    allowed: allowed && scopeDecision.allowed,
    reasons: [...reasons, ...scopeDecision.reasons],
  };
}

/** Domains whose publish can be routed through the approval queue. */
const ROUTABLE_PUBLISH_DOMAINS: readonly string[] = [
  "benefits",
  "documents",
  "events",
  "jobs",
  "news",
];

function nextStepFor(
  allowed: boolean,
  domain: ContentDomain,
  operation: ContentOperation
): string | null {
  if (allowed) {
    return null;
  }
  if (operation === "publish" && ROUTABLE_PUBLISH_DOMAINS.includes(domain)) {
    return "A publish you cannot perform directly can be routed to the campus management team as an approval request (`biso_request_approval`).";
  }
  return "Ask someone with the required scope, or use the admin app.";
}

export const identityModule: ToolModule = {
  name: "identity",
  title: "Identity and capabilities",
  description:
    "Who the server is acting as, what that principal may do, and the lookup values every other tool takes.",
  tools: [
    defineTool({
      name: "biso_whoami",
      title: "Current principal and scope",
      description:
        "Report the verified identity this server is acting as, the roles derived from its Appwrite team memberships, the campuses and departments in scope, and the write mode. Call this first: every scope in every other result is derived from it. Identity comes from the configured credential and can never be changed by a tool argument.",
      inputSchema: {},
      annotations: READ_ONLY,
      profiles: ALL_PROFILES,
      handler(_args, context) {
        const requestId = newRequestId();
        const principal = context.principal;
        const anonymous = isAnonymous(principal);

        return Promise.resolve(
          result({
            requestId,
            summary: anonymous
              ? "No user credential is configured. Only published, publicly visible data is reachable."
              : `Acting as ${principal.email ?? principal.userId} with profile "${principal.profile}" and roles [${principal.roles.join(", ") || "none"}].`,
            data: {
              principal: describePrincipal(principal),
              derivation: {
                source: anonymous
                  ? "none"
                  : "Appwrite account.get() + teams.list(), resolved at startup",
                note: "Roles come from Azure-AD-synced Appwrite team memberships: National + Operations Unit grants globaladmin; Ledelsen{City} + Campus-{City} grants campusadmin for that city; membership of the HR department grants the hr role, which is what gates recruitment.",
                activeCampusNarrowing:
                  "Not supported. The admin portal lets a global admin narrow to one campus with a cookie; there is no equivalent here because a tool argument that narrows scope is indistinguishable from one that widens it.",
              },
              server: describeConfig(context.config),
              mutations: {
                writeMode: context.mutation.writeMode,
                clientSupportsElicitation:
                  context.mutation.clientSupportsElicitation(),
                note:
                  context.mutation.writeMode === "propose"
                    ? "Every mutating tool returns a validated proposal and writes nothing."
                    : "Mutating tools can execute a proposal; restricted operations (payments, refunds, ledger postings, outbound messages, identity changes) are never executable from this server.",
              },
            },
            scope: anonymous ? PUBLIC_SCOPE : describeScope(principal),
          })
        );
      },
    }),

    defineTool({
      name: "biso_list_capabilities",
      title: "Capability and support matrix",
      description:
        "List which content operations are supported for which domain, and why the unsupported ones are unsupported. Use this before promising a user that something can be created, published or deleted — support varies by domain and is not uniform CRUD.",
      inputSchema: {
        domain: z
          .enum(CONTENT_DOMAINS)
          .optional()
          .describe("Restrict the matrix to one domain."),
      },
      annotations: READ_ONLY,
      profiles: ALL_PROFILES,
      handler(args, context) {
        const requestId = newRequestId();
        const matrix = supportMatrix().filter(
          (row) => !args.domain || row.domain === args.domain
        );
        const supportedCount = matrix.reduce(
          (total, row) =>
            total +
            Object.values(row.operations).filter((v) => v === "supported")
              .length,
          0
        );
        return Promise.resolve(
          result({
            requestId,
            summary: `${supportedCount} supported operations across ${matrix.length} content domain(s). Unsupported operations carry the reason.`,
            data: {
              matrix,
              operations: CONTENT_OPERATIONS,
              note: "Support is a property of this package, not of the platform: an operation marked unsupported may still be available in the admin app.",
            },
            scope: describeScope(context.principal),
          })
        );
      },
    }),

    defineTool({
      name: "biso_explain_permission",
      title: "Explain an access decision",
      description:
        "Explain whether the current principal may perform an operation on a content domain, and why. Answers questions like 'why can't I publish this?' without revealing anything about other users' memberships or resources.",
      inputSchema: {
        domain: z.enum(CONTENT_DOMAINS).describe("The content domain."),
        operation: z
          .enum(CONTENT_OPERATIONS)
          .describe("The operation being considered."),
        campusId: z
          .string()
          .optional()
          .describe(
            "Numeric campus id the operation would target, e.g. '1' for Oslo."
          ),
        departmentId: z
          .string()
          .optional()
          .describe("Appwrite departments row id the operation would target."),
      },
      annotations: READ_ONLY,
      profiles: ALL_PROFILES,
      handler(args, context) {
        const requestId = newRequestId();
        const principal = context.principal;
        const domain = args.domain as ContentDomain;
        const operation = args.operation as ContentOperation;

        const decision = decidePermission({
          principal,
          domain,
          operation,
          campusId: args.campusId,
          departmentId: args.departmentId,
        });

        return Promise.resolve(
          result({
            requestId,
            summary: decision.allowed
              ? `Allowed: ${operation} on ${domain}.`
              : `Not allowed: ${operation} on ${domain}.`,
            data: {
              allowed: decision.allowed,
              domain,
              operation,
              reasons: decision.reasons,
              nextStep: nextStepFor(decision.allowed, domain, operation),
              yourRoles: principal.roles,
              yourCampuses: principal.campusNames,
              yourDepartments: principal.departmentNames,
            },
            scope: describeScope(principal),
          })
        );
      },
    }),

    defineTool({
      name: "biso_list_campuses",
      title: "Campuses",
      description:
        "List BISO campuses with the numeric ids that content rows store in `campus_id`. National is campus 5 and is where organisation-wide content is filed.",
      inputSchema: {},
      annotations: READ_ONLY,
      profiles: ALL_PROFILES,
      async handler(_args, context) {
        const requestId = newRequestId();
        const campuses = await context.services.lookups.campuses();
        return result({
          requestId,
          summary: `${campuses.length} campuses.`,
          data: {
            campuses: campuses.map((campus) => ({
              ...campus,
              label: campusLabel(campus.id),
            })),
            teamNameToId: CAMPUS_NAME_TO_ID,
          },
          scope: describeScope(context.principal),
        });
      },
    }),

    defineTool({
      name: "biso_list_departments",
      title: "Departments and units",
      description:
        "List departments (units). Note that the `departments` table mirrors the 24SevenOffice chart of accounts, so `active` is not a publication flag: operating ledgers and national governance rows are active accounts with no public page. `publiclyListed` is the flag that decides whether students see a unit.",
      inputSchema: {
        campusId: z.string().optional().describe("Filter to one campus id."),
        publicOnly: z
          .boolean()
          .optional()
          .describe(
            "Only units a student would see listed. Defaults to false (the full chart of accounts)."
          ),
      },
      annotations: READ_ONLY,
      profiles: ALL_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const departments = await context.services.lookups.departments({
          campusId: args.campusId,
          publicOnly: args.publicOnly,
        });
        return result({
          requestId,
          summary: `${departments.length} departments${args.campusId ? ` in ${campusLabel(args.campusId)}` : ""}${args.publicOnly ? " (publicly listed only)" : ""}.`,
          data: { departments },
          scope: describeScope(context.principal),
        });
      },
    }),

    defineTool({
      name: "biso_resolve_department",
      title: "Resolve a department exactly",
      description:
        "Resolve a department name, slug or id to exactly one department. Refuses and lists the candidates when the reference is ambiguous rather than silently picking one — unit names repeat across campuses, so a near match is usually the wrong campus.",
      inputSchema: {
        reference: z
          .string()
          .min(1)
          .describe("A department id, exact name, slug, or partial name."),
      },
      annotations: READ_ONLY,
      profiles: ALL_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const department = await context.services.lookups.resolveDepartment(
          args.reference
        );
        return result({
          requestId,
          summary: `"${args.reference}" resolves to ${department.name} (${campusLabel(department.campusId)}).`,
          data: { department },
          scope: describeScope(context.principal),
        });
      },
    }),

    defineTool({
      name: "biso_list_feature_flags",
      title: "Feature flags",
      description:
        "List the platform's feature flags and their effective state. Several capabilities default to OFF (`payments_stripe`, `shop_ledger_posting`, `expenses_ledger_posting`); a flag being off is why a related workflow appears stalled rather than broken. This server never changes a flag.",
      inputSchema: {},
      annotations: READ_ONLY,
      profiles: STAFF_PROFILES,
      async handler(_args, context) {
        const requestId = newRequestId();
        const flags = await context.services.lookups.featureFlags();
        const off = flags.filter((flag) => !flag.enabled);
        return result({
          requestId,
          summary:
            off.length === 0
              ? `All ${flags.length} feature flags are on.`
              : `${off.length} of ${flags.length} flags are off: ${off.map((flag) => flag.key).join(", ")}.`,
          data: {
            flags,
            note: "`isDefault: true` means no row exists for the key and the catalogue default applies. Toggling flags is not available from this server.",
          },
          scope: describeScope(context.principal),
        });
      },
    }),

    defineTool({
      name: "biso_resolve_campus",
      title: "Resolve a campus",
      description:
        "Resolve a campus name to its numeric id, or an id to its name. Content rows store the numeric id.",
      inputSchema: {
        reference: z
          .string()
          .min(1)
          .describe("A campus name ('Oslo') or numeric id ('1')."),
      },
      annotations: READ_ONLY,
      profiles: ALL_PROFILES,
      async handler(args, context) {
        const requestId = newRequestId();
        const campuses = await context.services.lookups.campuses();
        const trimmed = args.reference.trim();
        const match =
          campuses.find((campus) => campus.id === trimmed) ??
          campuses.find(
            (campus) => campus.name.toLowerCase() === trimmed.toLowerCase()
          );
        if (!match) {
          throw invalidInput(`No campus matches "${trimmed}".`, {
            known: campuses.map((campus) => `${campus.name} (${campus.id})`),
          });
        }
        return result({
          requestId,
          summary: `${match.name} is campus ${match.id}.`,
          data: { campus: { ...match, label: campusLabel(match.id) } },
          scope: describeScope(context.principal),
        });
      },
    }),
  ],
};

/** One phrase describing where this principal may write content. */
function contentWriteReach(principal: Principal): string {
  if (isGlobalAdmin(principal)) {
    return "all campuses";
  }
  if (isCampusAdmin(principal)) {
    return `campuses ${principal.managedCampusIds.join(", ")}`;
  }
  if (hasDepartmentMembership(principal)) {
    return `departments ${principal.resolvedDepartmentIds.join(", ")}`;
  }
  return "none";
}

/** Exported so the capability resource can reuse the same reasoning. */
export function summariseAccess(context: {
  principal: Principal;
}): Record<string, unknown> {
  const principal = context.principal;
  return {
    profile: principal.profile,
    contentWrite: contentWriteReach(principal),
    recruitment: isHr(principal) || isGlobalAdmin(principal) ? "yes" : "no",
  };
}
