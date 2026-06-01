import { tool } from "ai";
import { z } from "zod";

/**
 * Client-side tools: no execute function.
 * The useChat onToolCall handler resolves these on the client,
 * then calls addToolResult to resume the stream.
 */
export const clientTools = {
  /**
   * Navigate to a route in the admin portal.
   * Resolved on client via useRouter().push(path).
   */
  navigate: tool({
    description:
      "Navigate to a specific page in the admin portal. Use this when the user wants to go somewhere or when a workflow requires opening a specific studio or list.",
    inputSchema: z.object({
      path: z.string().describe("The admin portal path, e.g. /jobs/new"),
      reason: z
        .string()
        .optional()
        .describe("Why we are navigating — shown in the chat"),
    }),
  }),

  /**
   * Ask the user to confirm an action before executing it.
   * The client renders a confirmation card; on confirm/cancel addToolResult
   * returns { confirmed: true } or { confirmed: false }.
   */
  confirmAction: tool({
    description:
      "Render a confirmation card before executing a write action (update, delete, publish, M365). Always call this before any mutation that doesn't go through showDraftPreview.",
    inputSchema: z.object({
      actionLabel: z
        .string()
        .describe("Short label, e.g. 'Publish job posting'"),
      description: z.string().describe("What will happen, shown to the user."),
      danger: z
        .boolean()
        .optional()
        .describe("True for destructive actions (delete, disable user)."),
    }),
  }),

  /**
   * Show an editable bilingual draft preview card.
   * The user can review, edit inline, then click Approve to execute or Cancel to discard.
   * On approval the client calls addToolResult({ approved: true, editedDraft }) so the
   * next step (createContent) can use the final version.
   */
  showDraftPreview: tool({
    description:
      "Display an interactive bilingual preview card for the user to review and optionally edit before saving. Always use this when drafting new content (jobs, events, news, benefits, shop products).",
    inputSchema: z.object({
      domain: z
        .enum([
          "jobs",
          "events",
          "news",
          "benefits",
          "shop",
          "documents",
          "pages",
        ])
        .describe("Content type"),
      titleNO: z.string(),
      titleEN: z.string(),
      descriptionNO: z.string(),
      descriptionEN: z.string(),
      /** Optional extra metadata to show (deadline, campus, etc.) */
      meta: z.record(z.string()).optional(),
    }),
  }),

  /**
   * Stream content into a live form that is currently mounted on the page.
   * Uses the form bridge store (zustand) — only works if the page has called
   * useAssistantFormTarget() (Job Studio, Event Studio).
   */
  fillForm: tool({
    description:
      "Fill fields in the currently open studio form with AI-generated content. Only use if the user is on a studio page (job/event studio) and a form is registered. Check currentPath first.",
    inputSchema: z.object({
      schemaId: z
        .string()
        .describe(
          "The form schema ID registered by the studio, e.g. 'job-studio'"
        ),
      fields: z.array(
        z.object({
          path: z
            .string()
            .describe(
              "Field path in the form, e.g. 'title_no', 'description_en'"
            ),
          value: z.string().describe("Value to set"),
        })
      ),
    }),
  }),

  /**
   * Submit an approval request to the appropriate team.
   * Resolves on the client: shows a card, user confirms, then calls
   * the createApprovalRequest server action via a client-side fetch.
   */
  requestApproval: tool({
    description:
      "When a server tool returns requiresApproval, use this to offer the user a way to route the action to the correct approver team for review.",
    inputSchema: z.object({
      action: z
        .string()
        .describe("The action that requires approval, e.g. 'jobs.publish'"),
      approverTeam: z
        .string()
        .describe(
          "Team name / ID that must approve, e.g. 'sg-app-dept-ledelsen-oslo'"
        ),
      payload: z
        .record(z.unknown())
        .describe("The full validated payload to execute if approved"),
      resourceType: z.string().describe("e.g. 'job'"),
      resourceId: z
        .string()
        .optional()
        .describe("Existing entity ID if applicable"),
    }),
  }),
};
