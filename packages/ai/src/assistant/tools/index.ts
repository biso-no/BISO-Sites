import type { ToolSet } from "ai";
import type { AssistantActionDeps, AssistantCapabilities } from "../types";
import { buildAnalyticsTools } from "./analytics";
import { buildApprovalTools } from "./approvals";
import { clientTools } from "./client-tools";
import { buildContentTools } from "./content";
import { buildM365Tools } from "./m365";
import { buildOpsTools } from "./ops";
import { buildReadTools } from "./read";
import { buildSettingsTools } from "./settings";
import { buildShopTools } from "./shop";

/**
 * Build the complete tool set for the assistant API route.
 * Only includes tools the user is permitted to use based on capabilities.
 * The deps object provides the actual server-action implementations
 * injected from apps/admin (keeping @repo/ai free of app dependencies).
 */
export function buildAssistantTools(
  capabilities: AssistantCapabilities,
  deps: AssistantActionDeps
): ToolSet {
  // Client tools are always available (no execute — resolved on client)
  const tools: ToolSet = { ...clientTools };

  // Read tools — always available (reads are scoped server-side)
  Object.assign(tools, buildReadTools(deps));

  // Content tools — available if user has at least "write" on any domain
  const hasContentAccess = Object.values(capabilities.domains).some(
    (level) => level === "write" || level === "publish"
  );
  if (hasContentAccess) {
    Object.assign(tools, buildContentTools(deps));
  }

  // Approval tools — available to campus admins and global admins
  if (capabilities.canApprove) {
    Object.assign(tools, buildApprovalTools(deps));
  }

  // Shop order/customer tools — campus admins and global admins
  if (capabilities.domains.shop === "publish") {
    Object.assign(tools, buildShopTools(deps));
  }

  // Ops tools (inbox counts, platform health) — approvers; health dep is
  // additionally gated to global admins server-side
  if (capabilities.canApprove) {
    Object.assign(tools, buildOpsTools(deps));
  }

  // M365 tools — global admin only
  if (capabilities.m365) {
    Object.assign(tools, buildM365Tools(deps));
  }

  // Settings tools — global admin only
  if (capabilities.settings) {
    Object.assign(tools, buildSettingsTools(deps));
  }

  // Analytics tools — global admin only
  if (capabilities.settings) {
    Object.assign(tools, buildAnalyticsTools(deps));
  }

  return tools;
}

export type { AssistantCapabilities } from "../types";
// Re-export client tools for use in the widget's typed useChat hook
export { clientTools } from "./client-tools";
