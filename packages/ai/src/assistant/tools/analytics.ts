import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

export function buildAnalyticsTools(deps: AssistantActionDeps) {
  return {
    getAnalyticsSummary: tool({
      description:
        "Get web.biso.no traffic analytics for a period: pageviews, visitors, top pages and total events. Answers 'how is the site doing?'. Only available to global admins.",
      inputSchema: z.object({
        range: z
          .enum(["7d", "30d", "90d"])
          .default("30d")
          .describe("Reporting period"),
      }),
      execute: async ({ range }) => {
        try {
          const result = await (
            deps.getAnalyticsSummary as (input: unknown) => Promise<unknown>
          )({ range });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Analytics fetch failed",
          };
        }
      },
    }),
  };
}
