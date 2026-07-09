import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

export function buildOpsTools(deps: AssistantActionDeps) {
  return {
    getInboxCounts: tool({
      description:
        "Get the current user's pending inbox counts: approval requests awaiting review and new form submissions. Use for questions like 'what needs my attention?'.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await (
            deps.getInboxCounts as () => Promise<unknown>
          )();
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Inbox counts failed",
          };
        }
      },
    }),
    getOpsHealth: tool({
      description:
        "Get platform operations health: required Appwrite teams status and external integration health (Microsoft 365, SharePoint, Vipps, etc.). Only available to global admins.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await (deps.getOpsHealth as () => Promise<unknown>)();
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Ops health failed",
          };
        }
      },
    }),
  };
}
