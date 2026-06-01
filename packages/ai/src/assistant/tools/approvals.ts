import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

export function buildApprovalTools(deps: AssistantActionDeps) {
  return {
    approveRequest: tool({
      description:
        "Approve a pending approval request. Only available to campus managers and global admins. Requires confirmAction first.",
      inputSchema: z.object({
        requestId: z.string().describe("The approval_requests $id"),
      }),
      execute: async ({ requestId }) => {
        try {
          const result = await (
            deps.approveRequest as (a: unknown) => Promise<unknown>
          )({
            requestId,
          });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Approval failed",
          };
        }
      },
    }),

    rejectRequest: tool({
      description:
        "Reject a pending approval request with a reason. Only available to campus managers and global admins. Requires confirmAction first.",
      inputSchema: z.object({
        requestId: z.string().describe("The approval_requests $id"),
        reason: z
          .string()
          .describe("Reason for rejection, shown to the requester"),
      }),
      execute: async ({ requestId, reason }) => {
        try {
          const result = await (
            deps.rejectRequest as (a: unknown) => Promise<unknown>
          )({
            requestId,
            reason,
          });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Rejection failed",
          };
        }
      },
    }),
  };
}
