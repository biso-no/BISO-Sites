import { openai } from "@ai-sdk/openai";
import { ADMIN_ASSISTANT_PROMPT } from "@repo/ai/prompts";
import {
  createFormFillerTool,
  eventFormFields,
} from "@repo/ai/tools/form-filler";
import {
  createNavigationTool,
  defaultAdminRoutes,
} from "@repo/ai/tools/navigation";
import { translateContentTool } from "@repo/ai/tools/translate";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

type RequestBody = {
  messages: UIMessage[];
  formContext?: {
    formId: string;
    formName: string;
    fields: Array<{
      id: string;
      name: string;
      type: string;
      label: string;
      required?: boolean;
      currentValue?: unknown;
    }>;
  };
};

export async function POST(req: Request) {
  const { messages, formContext }: RequestBody = await req.json();

  // Create navigation tool with admin routes
  const navigate = createNavigationTool(defaultAdminRoutes);

  // Create form filler tool
  const fillFormFields = formContext
    ? createFormFillerTool(
        formContext.fields.map((f) => ({
          id: f.id,
          name: f.name,
          type: f.type as
            | "text"
            | "textarea"
            | "number"
            | "date"
            | "select"
            | "checkbox",
          label: f.label,
          required: f.required,
          currentValue: f.currentValue,
        }))
      )
    : createFormFillerTool(eventFormFields);

  const tools = {
    navigate,
    fillFormFields,
    translateContent: translateContentTool,
  };

  const result = streamText({
    model: openai("gpt-5-mini"),
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    system: ADMIN_ASSISTANT_PROMPT,
    tools: tools as Parameters<typeof streamText>[0]["tools"],
  });

  return result.toUIMessageStreamResponse();
}
