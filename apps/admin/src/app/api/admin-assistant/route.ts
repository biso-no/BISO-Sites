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
import { createPageCreatorTool } from "@repo/ai/tools/page-creator";
import {
  createPuckGeneratorTool,
  createTaskAnalyzerTool,
} from "@repo/ai/tools/puck-generator";
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
  puckData?: unknown;
}

/**
 * Build page context section for AI prompt
 */
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

/**
 * Build entity context section for AI prompt
 */
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

/**
 * Build puck editor context section for AI prompt
 */
function buildPuckContextSection(puckData: unknown): string[] {
  const parts: string[] = [];
  parts.push(
    "## Editor Mode\nUser is on a Puck page editor. You can modify the page structure using generatePuckContent."
  );

  const puckPreview = JSON.stringify(puckData, null, 2);
  const truncatedPuck =
    puckPreview.length > 2000
      ? `${puckPreview.slice(0, 2000)}\n... (truncated)`
      : puckPreview;
  parts.push(
    `### Current Page Structure:\n\`\`\`json\n${truncatedPuck}\n\`\`\``
  );

  return parts;
}

export async function POST(req: Request) {
  const {
    messages,
    capability,
    formFields,
    currentPath,
    puckData,
    entityContext,
    pageContext,
  }: RequestBody = await req.json();

  // Get capability from path if not provided
  const detectedCapability =
    capability || (currentPath ? getCapabilityFromPath(currentPath)?.id : null);

  // Hardcoded Puck schema description to avoid client/server import issues
  const schemaDescription = `
Available Puck Components:

1. Hero - Main hero section with title, description, and optional buttons
2. FeatureGrid - Grid of feature cards (2-4 columns)
3. CTA - Call-to-action section with title, description, and buttons
4. About - About section with image and text
5. Accordion - Collapsible accordion items
6. Stats - Statistics display with numbers and labels
7. Testimonials - Customer testimonials/reviews
8. FAQ - Frequently asked questions
9. Pricing - Pricing tables/cards
10. Team - Team member cards with photos and info
11. Contact - Contact form section
12. Newsletter - Newsletter signup form
13. LogoCloud - Display of partner/client logos
14. Timeline - Timeline of events or milestones
15. Gallery - Image gallery grid
16. Video - Video embed section
17. Divider - Visual separator
18. Spacer - Vertical spacing
19. RichText - Rich text content editor
20. PageHeader - Page header with breadcrumbs
21. TableOfContents - Table of contents navigation

Each component has an "id" prop (required, unique identifier) and various content props.
Generate valid JSON with "content" array containing component objects with "type" and "props".
`;

  const puckExample = `
Example page structure:
{
  "content": [
    {
      "type": "Hero",
      "props": {
        "id": "Hero-1",
        "title": "Welcome to BISO",
        "description": "The BI Student Organisation",
        "align": "center"
      }
    },
    {
      "type": "FeatureGrid",
      "props": {
        "id": "FeatureGrid-1",
        "title": "What We Offer",
        "columns": 3,
        "features": []
      }
    }
  ]
}
`;

  // Create navigation tool with admin routes
  const navigate = createNavigationTool(defaultAdminRoutes);

  // Create task analyzer tool
  const analyzeTask = createTaskAnalyzerTool();

  // Create page creator tool
  const createPage = createPageCreatorTool();

  // Create Puck content generator tool
  const generatorToolInput = `${schemaDescription}\n\n${puckExample}`;
  const generatePuckContent = createPuckGeneratorTool(generatorToolInput);

  // Create form filler tool - use provided fields, capability fields, or default to event fields
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
    analyzeTask,
    navigate,
    createPage,
    generatePuckContent,
    fillFormFields,
    translateContent: translateContentTool,
  };

  // Build rich context for the AI using extracted helpers
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

  if (puckData) {
    contextParts.push(...buildPuckContextSection(puckData));
  }

  const contextInfo = contextParts.join("\n\n");

  const systemPrompt = getSystemPrompt("admin", contextInfo);

  const result = streamText({
    model: openai("gpt-5"),
    messages: convertToModelMessages(messages),
    system: systemPrompt,
    tools: tools as Parameters<typeof streamText>[0]["tools"],
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
