import { openai } from "@ai-sdk/openai";
import { getSystemPrompt } from "@repo/ai/prompts";
import {
  CAPABILITY_REGISTRY,
  getCapabilityFromPath,
} from "@repo/ai/schemas/registry";
import type { PageCapability } from "@repo/ai/stores/copilot-store";
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

interface EntityContext {
  data: Record<string, unknown>;
  id: string;
  locale?: string;
  metadata?: {
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    author?: string;
  };
  title: string;
  type: string;
}

interface PageContext {
  breadcrumb?: string[];
  filters?: Record<string, unknown>;
  listSummary?: {
    totalCount: number;
    displayedCount: number;
    items?: Array<{ id: string; title: string; status?: string }>;
  };
  section: string;
  viewType: string;
}

interface RequestBody {
  capability?: PageCapability;
  currentPath?: string;
  entityContext?: EntityContext;
  formFields?: Array<{
    id: string;
    name: string;
    type: string;
    label: string;
    required?: boolean;
    currentValue?: unknown;
  }>;
  messages: UIMessage[];
  pageContext?: PageContext;
}

function buildPageContextSection(pageContext: PageContext): string[] {
  const parts: string[] = [];

  const pageInfo = [
    `Section: ${pageContext.section}`,
    `View Type: ${pageContext.viewType}`,
    pageContext.breadcrumb?.length
      ? `Breadcrumb: ${pageContext.breadcrumb.join(" > ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  parts.push(`## Page Context\n${pageInfo}`);

  if (pageContext.listSummary) {
    const listInfo = [
      `Total items: ${pageContext.listSummary.totalCount}`,
      `Displayed: ${pageContext.listSummary.displayedCount}`,
      pageContext.listSummary.items?.length
        ? `Recent items:\n${pageContext.listSummary.items.map((i) => `  - ${i.title} (${i.status || "unknown"})`).join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    parts.push(`## List Summary\n${listInfo}`);
  }

  return parts;
}

function buildEntityContextSection(entityContext: EntityContext): string {
  const entityInfo = [
    `Type: ${entityContext.type}`,
    `ID: ${entityContext.id}`,
    `Title: "${entityContext.title}"`,
    entityContext.locale ? `Locale: ${entityContext.locale}` : null,
    entityContext.metadata?.status
      ? `Status: ${entityContext.metadata.status}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const dataPreview = JSON.stringify(entityContext.data, null, 2);
  const truncatedData =
    dataPreview.length > 3000
      ? `${dataPreview.slice(0, 3000)}\n... (truncated)`
      : dataPreview;

  return `## Current Entity\n${entityInfo}\n\n### Entity Data:\n\`\`\`json\n${truncatedData}\n\`\`\``;
}

export async function POST(req: Request) {
  const {
    messages,
    capability,
    formFields,
    currentPath,
    entityContext,
    pageContext,
  }: RequestBody = await req.json();

  const detectedCapability =
    capability || (currentPath ? getCapabilityFromPath(currentPath)?.id : null);

  const navigate = createNavigationTool(defaultAdminRoutes);

  let formFieldsForTool: Array<{
    id: string;
    name: string;
    type: "text" | "textarea" | "number" | "date" | "select" | "checkbox";
    label: string;
    required?: boolean;
    currentValue?: unknown;
  }>;
  if (formFields && formFields.length > 0) {
    formFieldsForTool = formFields.map((f) => ({
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
    }));
  } else if (
    detectedCapability &&
    CAPABILITY_REGISTRY[detectedCapability]?.formFields.length
  ) {
    formFieldsForTool = CAPABILITY_REGISTRY[detectedCapability].formFields;
  } else {
    formFieldsForTool = eventFormFields;
  }

  const fillFormFields = createFormFillerTool(formFieldsForTool);

  const tools = {
    navigate,
    fillFormFields,
    translateContent: translateContentTool,
  };

  const contextParts: string[] = [];

  if (currentPath) {
    contextParts.push(`## Current Location\nPath: ${currentPath}`);
  }

  if (pageContext) {
    contextParts.push(...buildPageContextSection(pageContext));
  }

  if (entityContext) {
    contextParts.push(buildEntityContextSection(entityContext));
  }

  const contextInfo = contextParts.join("\n\n");
  const systemPrompt = getSystemPrompt("admin", contextInfo);

  const result = streamText({
    model: openai("gpt-5"),
    messages: await convertToModelMessages(messages),
    system: systemPrompt,
    tools: tools as Parameters<typeof streamText>[0]["tools"],
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
