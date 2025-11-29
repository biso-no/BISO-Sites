import { tool } from "ai";
import { z } from "zod";
import type { FormFieldInfo } from "../types";

const formUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        fieldId: z.string().describe("The ID of the field to update"),
        value: z.string().describe("The value to set for the field"),
      })
    )
    .describe("Array of field updates to apply"),
});

type FormUpdateParams = z.infer<typeof formUpdateSchema>;
type FieldUpdate = FormUpdateParams["updates"][number];

/**
 * Create a form filler tool for the assistant
 * This tool allows the AI to stream data directly into form fields
 */
export function createFormFillerTool(fields: FormFieldInfo[]) {
  const fieldIds = fields.map((f) => f.id);
  const fieldDescriptions = fields
    .map(
      (f) => `- ${f.id}: ${f.label} (${f.type}${f.required ? ", required" : ""})`
    )
    .join("\n");

  return tool({
    description: `Fill form fields with values. Available fields:\n${fieldDescriptions}`,
    inputSchema: formUpdateSchema,
    execute: async ({ updates }: FormUpdateParams) => {
      const results: Array<{
        fieldId: string;
        success: boolean;
        error?: string;
      }> = [];

      for (const update of updates) {
        const field = fields.find((f) => f.id === update.fieldId);

        if (!field) {
          results.push({
            fieldId: update.fieldId,
            success: false,
            error: `Unknown field: ${update.fieldId}. Available fields: ${fieldIds.join(", ")}`,
          });
          continue;
        }

        // Return action for the client to execute
        results.push({
          fieldId: update.fieldId,
          success: true,
        });
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      const actions = updates
        .filter((u: FieldUpdate) =>
          results.find((r) => r.fieldId === u.fieldId)?.success
        )
        .map((u: FieldUpdate) => ({
          type: "form-field" as const,
          fieldId: u.fieldId,
          fieldName: fields.find((f) => f.id === u.fieldId)?.label ?? u.fieldId,
          value: u.value,
          streaming: false,
        }));

      return await Promise.resolve({
        success: failCount === 0,
        results,
        actions,
        message:
          failCount === 0
            ? `Updated ${successCount} field(s) successfully`
            : `Updated ${successCount} field(s), ${failCount} failed`,
      });
    },
  });
}

const streamingFormSchema = z.object({
  fieldId: z.string().describe("The ID of the field to stream into"),
  content: z.string().describe("The full content to stream into the field"),
});

type StreamingFormParams = z.infer<typeof streamingFormSchema>;

/**
 * Create a streaming form filler tool
 * This streams content character by character into a field
 */
export function createStreamingFormFillerTool(fields: FormFieldInfo[]) {
  const fieldDescriptions = fields
    .filter((f) => f.type === "text" || f.type === "textarea")
    .map((f) => `- ${f.id}: ${f.label}`)
    .join("\n");

  return tool({
    description: `Stream content into a text field character by character for a typewriter effect. Best for longer content like descriptions. Available text fields:\n${fieldDescriptions}`,
    inputSchema: streamingFormSchema,
    execute: async ({ fieldId, content }: StreamingFormParams) => {
      const field = fields.find((f) => f.id === fieldId);

      if (!field) {
        return await Promise.resolve({
          success: false,
          error: `Unknown field: ${fieldId}`,
        });
      }

      if (field.type !== "text" && field.type !== "textarea") {
        return await Promise.resolve({
          success: false,
          error: `Field ${fieldId} is not a text field. Use regular form filler for ${field.type} fields.`,
        });
      }

      return await Promise.resolve({
        success: true,
        action: {
          type: "form-field" as const,
          fieldId,
          fieldName: field.label,
          value: content,
          streaming: true,
        },
        message: `Streaming content into ${field.label}...`,
      });
    },
  });
}

/**
 * Event form fields definition
 */
export const eventFormFields: FormFieldInfo[] = [
  {
    id: "translations.en.title",
    name: "title_en",
    type: "text",
    label: "English Title",
    required: true,
  },
  {
    id: "translations.no.title",
    name: "title_no",
    type: "text",
    label: "Norwegian Title",
    required: true,
  },
  {
    id: "translations.en.description",
    name: "description_en",
    type: "textarea",
    label: "English Description",
    required: true,
  },
  {
    id: "translations.no.description",
    name: "description_no",
    type: "textarea",
    label: "Norwegian Description",
    required: true,
  },
  {
    id: "slug",
    name: "slug",
    type: "text",
    label: "URL Slug",
    required: true,
  },
  {
    id: "start_date",
    name: "start_date",
    type: "date",
    label: "Start Date",
  },
  {
    id: "end_date",
    name: "end_date",
    type: "date",
    label: "End Date",
  },
  {
    id: "location",
    name: "location",
    type: "text",
    label: "Location",
  },
  {
    id: "price",
    name: "price",
    type: "number",
    label: "Price (NOK)",
  },
  {
    id: "ticket_url",
    name: "ticket_url",
    type: "text",
    label: "Ticket URL",
  },
  {
    id: "member_only",
    name: "member_only",
    type: "checkbox",
    label: "Members Only",
  },
  {
    id: "status",
    name: "status",
    type: "select",
    label: "Status",
    options: [
      { value: "draft", label: "Draft" },
      { value: "published", label: "Published" },
      { value: "cancelled", label: "Cancelled" },
    ],
  },
];
