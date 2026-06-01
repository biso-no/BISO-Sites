import type { AssistantCapabilities, ContentAccess } from "./types";

export interface AssistantAuthInput {
  /** ctx.departmentTeamIds.length > 0 */
  hasDepartmentMembership: boolean;
  /** ctx.managedCampuses.length > 0 */
  isCampusAdmin: boolean;
  /** ctx.roles: ["globaladmin"] | ["campusadmin"] | [] */
  roles: string[];
}

function contentAccessLevel(
  input: AssistantAuthInput,
  navAccess: boolean
): ContentAccess {
  if (!navAccess) {
    return "none";
  }
  const isGlobalAdmin = input.roles.includes("globaladmin");
  const isCampusAdmin = input.roles.includes("campusadmin");
  if (isGlobalAdmin || isCampusAdmin) {
    return "publish";
  }
  if (input.hasDepartmentMembership) {
    return "write";
  }
  return "read";
}

/**
 * Build the capability map for the assistant from the auth context.
 * The actual permission enforcement happens inside each tool's execute
 * function (via assertWriteAccess etc.). This is only used to:
 *  - Filter which tools are exposed to the model
 *  - Build the capability summary in the system prompt
 */
export function buildAssistantCapabilities(
  input: AssistantAuthInput
): AssistantCapabilities {
  const isGlobalAdmin = input.roles.includes("globaladmin");
  const isCampusAdmin = input.roles.includes("campusadmin");

  // Content domains: all require portal nav access to be useful
  // Department users have write (but not publish) on content domains
  const contentAccess = contentAccessLevel(input, true);

  return {
    canApprove: isGlobalAdmin || isCampusAdmin,
    m365: isGlobalAdmin,
    settings: isGlobalAdmin,
    domains: {
      benefits: contentAccess,
      documents: contentAccess,
      events: contentAccess,
      jobs: contentAccess,
      news: contentAccess,
      pages: isGlobalAdmin || isCampusAdmin ? "publish" : "none",
      shop: isGlobalAdmin || isCampusAdmin ? "publish" : "none",
    },
  };
}

/** Human-readable summary of capabilities for the system prompt */
export function capabilitiesSummary(caps: AssistantCapabilities): string {
  const parts: string[] = [];
  for (const [domain, level] of Object.entries(caps.domains)) {
    if (level !== "none") {
      parts.push(`${domain}:${level}`);
    }
  }
  if (caps.m365) {
    parts.push("m365:manage");
  }
  if (caps.settings) {
    parts.push("settings:manage");
  }
  return parts.join(", ") || "read-only";
}
