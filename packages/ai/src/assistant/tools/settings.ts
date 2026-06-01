import { tool } from "ai";
import { z } from "zod";
import type { AssistantActionDeps } from "../types";

export function buildSettingsTools(deps: AssistantActionDeps) {
  return {
    getFeatureFlags: tool({
      description:
        "List current feature flags and their enabled/disabled state. Only available to global admins.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const result = await (
            deps.getFeatureFlags as () => Promise<unknown>
          )();
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Feature flags fetch failed",
          };
        }
      },
    }),

    toggleFeatureFlag: tool({
      description:
        "Enable or disable a feature flag. Requires confirmAction first. Only available to global admins.",
      inputSchema: z.object({
        flagKey: z.string().describe("Feature flag identifier"),
        enabled: z.boolean().describe("True to enable, false to disable"),
      }),
      execute: async ({ flagKey, enabled }) => {
        try {
          const result = await (
            deps.toggleFeatureFlag as (a: unknown) => Promise<unknown>
          )({
            flagKey,
            enabled,
          });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Toggle failed",
          };
        }
      },
    }),
  };
}
