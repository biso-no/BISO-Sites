import { generateObject, tool } from "ai";
import { z } from "zod";
import { draftModel } from "../models";
import type { AssistantActionDeps } from "../types";

const CONTENT_DOMAIN = z.enum([
  "jobs",
  "events",
  "news",
  "benefits",
  "shop",
  "documents",
]);

const BILINGUAL_DRAFT_SCHEMA = z.object({
  titleNO: z.string().describe("Norwegian title"),
  titleEN: z.string().describe("English title"),
  descriptionNO: z
    .string()
    .describe("Norwegian description (markdown, 2-4 paragraphs)"),
  descriptionEN: z
    .string()
    .describe("English description (markdown, 2-4 paragraphs)"),
  slugSuggestion: z
    .string()
    .describe("URL slug: lowercase, hyphens, based on English title"),
});

function isApprovalRequiredResult(
  value: unknown
): value is Record<string, unknown> & { requiresApproval: true } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).requiresApproval === true
  );
}

export function buildContentTools(deps: AssistantActionDeps) {
  return {
    /**
     * Generate a bilingual (NO+EN) content draft using structured output.
     * Always call this before showDraftPreview.
     */
    draftBilingualContent: tool({
      description:
        "Generate a professional bilingual (Norwegian + English) draft for a content entity. Call this whenever you need to create or substantially rewrite content. Returns structured NO+EN fields ready for showDraftPreview.",
      inputSchema: z.object({
        domain: CONTENT_DOMAIN,
        prompt: z
          .string()
          .describe(
            "What the content should be about — include any details the user provided (position name, dates, location, etc.)"
          ),
        additionalContext: z
          .string()
          .optional()
          .describe(
            "Any extra context: campus, department, tone requirements, etc."
          ),
      }),
      execute: async ({ domain, prompt, additionalContext }) => {
        try {
          const { object } = await generateObject({
            model: draftModel,
            schema: BILINGUAL_DRAFT_SCHEMA,
            system: `You are a bilingual content writer for BI Student Organisation (BISO), a Norwegian student org.
Generate professional, engaging ${domain} content in BOTH Norwegian Bokmål and English.
Norwegian is primary and authoritative. English is the translation.
Use markdown for descriptions (bold for emphasis, bullet lists for details).
For jobs: include responsibilities, requirements, and what BISO offers. Keep titles clear and professional.
For events: include what, when, where, why and a call-to-action.
For news: journalistic tone, key facts first.
${additionalContext ? `Additional context: ${additionalContext}` : ""}`,
            prompt: `Create ${domain} content: ${prompt}`,
          });
          return { success: true, draft: object };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Draft generation failed",
          };
        }
      },
    }),

    /**
     * Create a new content entity.
     * The payload has already been reviewed via showDraftPreview.
     * Returns requiresApproval if the user lacks publish permission.
     */
    createContent: tool({
      description:
        "Save a new content entity to the database (after user has approved the draft via showDraftPreview). The entity is saved as a draft unless the user explicitly requested publish.",
      inputSchema: z.object({
        domain: CONTENT_DOMAIN,
        payload: z
          .record(z.string(), z.unknown())
          .describe("The validated content payload from the approved draft"),
        publish: z
          .boolean()
          .default(false)
          .describe("Whether to publish immediately vs. save as draft"),
        campusId: z
          .string()
          .optional()
          .describe("Campus numeric ID string, required for scoped content"),
        departmentId: z
          .string()
          .optional()
          .describe("Department $id, if applicable"),
      }),
      execute: async ({ domain, payload, publish, campusId, departmentId }) => {
        try {
          const result = await (
            deps.createContent as (a: unknown) => Promise<unknown>
          )({
            domain,
            payload,
            publish,
            campusId,
            departmentId,
          });
          if (isApprovalRequiredResult(result)) {
            return { success: false, ...result };
          }
          return { success: true, data: result };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Create failed";
          // Detect permission errors and return structured requiresApproval
          if (
            msg.toLowerCase().includes("forbidden") ||
            msg.toLowerCase().includes("unauthorized") ||
            msg.toLowerCase().includes("no write access")
          ) {
            return {
              success: false,
              requiresApproval: true,
              action: `${domain}.${publish ? "publish" : "create"}`,
              error: msg,
            };
          }
          return { success: false, error: msg };
        }
      },
    }),

    /**
     * Update an existing content entity.
     */
    updateContent: tool({
      description:
        "Update fields on an existing content entity. Only call after confirmAction has been approved.",
      inputSchema: z.object({
        domain: CONTENT_DOMAIN,
        id: z.string().describe("Entity $id"),
        payload: z.record(z.string(), z.unknown()).describe("Fields to update"),
      }),
      execute: async ({ domain, id, payload }) => {
        try {
          const result = await (
            deps.updateContent as (a: unknown) => Promise<unknown>
          )({
            domain,
            id,
            payload,
          });
          return { success: true, data: result };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Update failed";
          if (
            msg.toLowerCase().includes("forbidden") ||
            msg.toLowerCase().includes("unauthorized")
          ) {
            return {
              success: false,
              requiresApproval: true,
              action: `${domain}.update`,
              error: msg,
            };
          }
          return { success: false, error: msg };
        }
      },
    }),

    /**
     * Publish a content entity (set status to published).
     * Returns requiresApproval if the user lacks publish rights.
     */
    publishContent: tool({
      description:
        "Publish a content entity — sets status to 'published'. Only call after explicit user confirmation.",
      inputSchema: z.object({
        domain: CONTENT_DOMAIN,
        id: z.string().describe("Entity $id"),
      }),
      execute: async ({ domain, id }) => {
        try {
          const result = await (
            deps.publishContent as (a: unknown) => Promise<unknown>
          )({
            domain,
            id,
          });
          return { success: true, data: result };
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Publish failed";
          if (
            msg.toLowerCase().includes("forbidden") ||
            msg.toLowerCase().includes("unauthorized")
          ) {
            return {
              success: false,
              requiresApproval: true,
              action: `${domain}.publish`,
              error: msg,
            };
          }
          return { success: false, error: msg };
        }
      },
    }),

    /**
     * Delete a content entity (destructive — requires confirmAction with danger:true first).
     */
    deleteContent: tool({
      description:
        "Delete a content entity permanently. Only call after a confirmAction with danger:true has been approved. This is irreversible.",
      inputSchema: z.object({
        domain: CONTENT_DOMAIN,
        id: z.string().describe("Entity $id"),
      }),
      execute: async ({ domain, id }) => {
        try {
          const result = await (
            deps.deleteContent as (a: unknown) => Promise<unknown>
          )({
            domain,
            id,
          });
          return { success: true, data: result };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Delete failed",
          };
        }
      },
    }),
  };
}
