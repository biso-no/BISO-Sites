import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

const CONTENT_DOMAIN = z.enum([
  "jobs",
  "events",
  "news",
  "benefits",
  "shop",
  "pages",
  "documents",
]);

export function buildReadTools(deps: AssistantActionDeps) {
  return {
    /**
     * Search / list content entities in any domain.
     * Scope is automatically applied server-side based on the user's auth context.
     */
    searchContent: tool({
      description:
        "Search or list content entities (jobs, events, news, etc.). Results are scoped to the user's campus/department automatically.",
      inputSchema: z.object({
        domain: CONTENT_DOMAIN,
        query: z
          .string()
          .optional()
          .describe("Free-text search term (optional)"),
        status: z
          .enum(["draft", "published", "archived"])
          .optional()
          .describe("Filter by status"),
        limit: z
          .number()
          .min(1)
          .max(20)
          .default(10)
          .describe("Max results to return"),
      }),
      execute: async ({ domain, query, status, limit }) => {
        try {
          const result = await (
            deps.searchContent as (a: unknown) => Promise<unknown>
          )({
            domain,
            query,
            status,
            limit,
          });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Search failed",
          };
        }
      },
    }),

    /**
     * Fetch a single content entity by ID.
     */
    getContent: tool({
      description: "Fetch a single content entity by its ID.",
      inputSchema: z.object({
        domain: CONTENT_DOMAIN,
        id: z.string().describe("The entity $id"),
      }),
      execute: async ({ domain, id }) => {
        try {
          const result = await (
            deps.getContent as (a: unknown) => Promise<unknown>
          )({
            domain,
            id,
          });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Fetch failed",
          };
        }
      },
    }),

    /**
     * Get dashboard statistics overview.
     */
    getDashboardStats: tool({
      description:
        "Retrieve an overview of dashboard statistics: published/draft/closing soon jobs, pending items, recent activity.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await (
            deps.getDashboardStats as () => Promise<unknown>
          )();
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Stats fetch failed",
          };
        }
      },
    }),

    /**
     * List pending approval requests the user can act on.
     */
    listPendingApprovals: tool({
      description:
        "List approval requests that need the current user's review (as a campus manager or global admin).",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await (
            deps.listPendingApprovals as () => Promise<unknown>
          )();
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Fetch failed",
          };
        }
      },
    }),
  };
}
