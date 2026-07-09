import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

export function buildShopTools(deps: AssistantActionDeps) {
  return {
    searchOrders: tool({
      description:
        "Search webshop orders by buyer name, email or order id, optionally filtered by status. Results are scoped to the user's campus automatically.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Buyer name, email or order id fragment"),
        status: z
          .enum([
            "pending",
            "authorized",
            "paid",
            "cancelled",
            "failed",
            "refunded",
          ])
          .optional()
          .describe("Filter by order status"),
      }),
      execute: async ({ query, status }) => {
        try {
          const result = await (
            deps.searchOrders as (input: unknown) => Promise<unknown>
          )({ query, status });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Order search failed",
          };
        }
      },
    }),
    getOrderSummary: tool({
      description:
        "Get a full summary of one order: status, totals, payment provider, buyer and line items.",
      inputSchema: z.object({
        orderId: z.string().describe("The order row $id"),
      }),
      execute: async ({ orderId }) => {
        try {
          const result = await (
            deps.getOrderSummary as (input: unknown) => Promise<unknown>
          )({ orderId });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Order lookup failed",
          };
        }
      },
    }),
    lookupCustomer: tool({
      description:
        "Look up a customer/member profile by name or email: campus, student id, membership ids. Only available to global admins.",
      inputSchema: z.object({
        query: z.string().min(2).describe("Name or email fragment"),
      }),
      execute: async ({ query }) => {
        try {
          const result = await (
            deps.lookupCustomer as (input: unknown) => Promise<unknown>
          )({ query });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Customer lookup failed",
          };
        }
      },
    }),
  };
}
