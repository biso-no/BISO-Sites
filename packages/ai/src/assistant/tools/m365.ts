import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

export function buildM365Tools(deps: AssistantActionDeps) {
  return {
    searchM365Users: tool({
      description:
        "Search for Microsoft 365 users in the BISO tenant by name or email. Only available to global admins.",
      inputSchema: z.object({
        query: z.string().describe("Search term (name or email)"),
        limit: z.number().min(1).max(20).default(10),
      }),
      execute: async ({ query, limit }) => {
        try {
          const result = await (
            deps.searchM365Users as (a: unknown) => Promise<unknown>
          )({
            query,
            limit,
          });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "M365 search failed",
          };
        }
      },
    }),

    createM365User: tool({
      description:
        "Create a new Microsoft 365 user in the BISO tenant. Requires confirmation first. Only available to global admins.",
      inputSchema: z.object({
        firstName: z.string(),
        lastName: z.string(),
        upnPrefix: z
          .string()
          .describe("Username part of UPN before @biso.no, e.g. 'john.doe'"),
        campus: z.string().describe("Campus name, e.g. 'Oslo'"),
        department: z.string().describe("Department name"),
        jobTitle: z.string().optional(),
        manager: z.string().optional().describe("Manager UPN"),
      }),
      execute: async (input) => {
        try {
          const result = await (
            deps.createM365User as (a: unknown) => Promise<unknown>
          )(input);
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "M365 user creation failed",
          };
        }
      },
    }),

    getM365UserProfile: tool({
      description: "Get a detailed profile for an M365 user by UPN or user ID.",
      inputSchema: z.object({
        userId: z.string().describe("M365 user $id or UPN"),
      }),
      execute: async ({ userId }) => {
        try {
          const result = await (
            deps.getM365UserProfile as (a: unknown) => Promise<unknown>
          )({
            userId,
          });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Profile fetch failed",
          };
        }
      },
    }),
  };
}
