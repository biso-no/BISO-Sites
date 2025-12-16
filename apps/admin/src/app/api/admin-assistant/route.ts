import { openai } from "@ai-sdk/openai";
import { getSystemPrompt } from "@repo/ai/prompts";
import {
  createFormFillerTool,
  eventFormFields,
} from "@repo/ai/tools/form-filler";
import {
  createNavigationTool,
  defaultAdminRoutes,
} from "@repo/ai/tools/navigation";
import {
  createPuckGeneratorTool,
  createTaskAnalyzerTool,
} from "@repo/ai/tools/puck-generator";
import { createPageCreatorTool } from "@repo/ai/tools/page-creator";
import { translateContentTool } from "@repo/ai/tools/translate";
import {
  getCapabilityFromPath,
  getCapabilitiesDescription,
  getFormFieldsDescription,
  CAPABILITY_REGISTRY,
} from "@repo/ai/schemas/registry";
import type { PageCapability } from "@repo/ai/stores/copilot-store";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
} from "ai";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

type EntityContext = {
  type: string;
  id: string;
  title: string;
  data: Record<string, unknown>;
  locale?: string;
  metadata?: {
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    author?: string;
  };
};

type PageContext = {
  section: string;
  viewType: string;
  breadcrumb?: string[];
  filters?: Record<string, unknown>;
  listSummary?: {
    totalCount: number;
    displayedCount: number;
    items?: Array<{ id: string; title: string; status?: string }>;
  };
};

type RequestBody = {
  messages: UIMessage[];
  capability?: PageCapability;
  formFields?: Array<{
    id: string;
    name: string;
    type: string;
    label: string;
    required?: boolean;
    currentValue?: unknown;
  }>;
  currentPath?: string;
  puckData?: unknown;
  entityContext?: EntityContext;
  pageContext?: PageContext;
};

export async function POST(req: Request) {
  console.log("--- AI Chat API Request Received ---");
  
  const { messages, capability, formFields, currentPath, puckData, entityContext, pageContext }: RequestBody =
    await req.json();
    
  // Log request inputs
  console.log(`Input messages count: ${messages.length}`);
  console.log(`Current Path: ${currentPath}`);
  console.log(`Capability: ${capability || "none"}`);
  console.log(`Form Fields count: ${formFields?.length || 0}`);
  console.log(`Puck Data present (Editor mode): ${!!puckData}`);
  console.log(`Entity Context: ${entityContext ? `${entityContext.type}:${entityContext.id}` : "none"}`);
  console.log(`Page Context: ${pageContext ? `${pageContext.section}/${pageContext.viewType}` : "none"}`);

  // Get capability from path if not provided
  const detectedCapability = capability || (currentPath ? getCapabilityFromPath(currentPath)?.id : null);

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
  
  console.log("Using hardcoded Puck schema (avoiding config import issues).");

  // --- Tool Initialization and Logging ---

  // Create navigation tool with admin routes
  const navigate = createNavigationTool(defaultAdminRoutes);
  console.log("Navigation tool created.");

  // Create task analyzer tool
  const analyzeTask = createTaskAnalyzerTool();
  console.log("Task analyzer tool created.");

  // Create page creator tool
  const createPage = createPageCreatorTool();
  console.log("Page creator tool created.");

  // Create Puck content generator tool
  const generatorToolInput = `${schemaDescription}\n\n${puckExample}`;
  console.log(`Puck Generator tool initialized with schema length: ${generatorToolInput.length} characters.`);
  const generatePuckContent = createPuckGeneratorTool(
    generatorToolInput
  );

  // Create form filler tool - use provided fields, capability fields, or default to event fields
  let formFieldsForTool;
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
    console.log(`Form filler tool initialized with ${formFieldsForTool.length} fields from request.`);
  } else if (detectedCapability && CAPABILITY_REGISTRY[detectedCapability]?.formFields.length) {
    formFieldsForTool = CAPABILITY_REGISTRY[detectedCapability].formFields;
    console.log(`Form filler tool initialized with ${formFieldsForTool.length} fields from capability registry (${detectedCapability}).`);
  } else {
    formFieldsForTool = eventFormFields;
    console.log(`Form filler tool initialized with default eventFormFields (${formFieldsForTool.length} fields).`);
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
  
  // Log the active tools
  console.log(`Active tools for this request: ${Object.keys(tools).join(", ")}`);

  // --- System Prompt Building ---

  // Build rich context for the AI
  const contextParts: string[] = [];

  // Current location
  if (currentPath) {
    contextParts.push(`## Current Location\nPath: ${currentPath}`);
  }

  // Page context (what section/view type)
  if (pageContext) {
    const pageInfo = [
      `Section: ${pageContext.section}`,
      `View Type: ${pageContext.viewType}`,
      pageContext.breadcrumb?.length ? `Breadcrumb: ${pageContext.breadcrumb.join(" > ")}` : null,
    ].filter(Boolean).join("\n");
    contextParts.push(`## Page Context\n${pageInfo}`);

    // List summary if on a list page
    if (pageContext.listSummary) {
      const listInfo = [
        `Total items: ${pageContext.listSummary.totalCount}`,
        `Displayed: ${pageContext.listSummary.displayedCount}`,
        pageContext.listSummary.items?.length
          ? `Recent items:\n${pageContext.listSummary.items.map(i => `  - ${i.title} (${i.status || "unknown"})`).join("\n")}`
          : null,
      ].filter(Boolean).join("\n");
      contextParts.push(`## List Summary\n${listInfo}`);
    }
  }

  // Entity context (the thing being viewed/edited)
  if (entityContext) {
    const entityInfo = [
      `Type: ${entityContext.type}`,
      `ID: ${entityContext.id}`,
      `Title: "${entityContext.title}"`,
      entityContext.locale ? `Locale: ${entityContext.locale}` : null,
      entityContext.metadata?.status ? `Status: ${entityContext.metadata.status}` : null,
    ].filter(Boolean).join("\n");
    
    // Include relevant entity data (sanitized for prompt)
    const dataPreview = JSON.stringify(entityContext.data, null, 2);
    const truncatedData = dataPreview.length > 3000 
      ? dataPreview.substring(0, 3000) + "\n... (truncated)"
      : dataPreview;
    
    contextParts.push(`## Current Entity\n${entityInfo}\n\n### Entity Data:\n\`\`\`json\n${truncatedData}\n\`\`\``);
  }

  // Puck editor context
  if (puckData) {
    contextParts.push("## Editor Mode\nUser is on a Puck page editor. You can modify the page structure using generatePuckContent.");
    
    // Include current Puck data structure
    const puckPreview = JSON.stringify(puckData, null, 2);
    const truncatedPuck = puckPreview.length > 2000
      ? puckPreview.substring(0, 2000) + "\n... (truncated)"
      : puckPreview;
    contextParts.push(`### Current Page Structure:\n\`\`\`json\n${truncatedPuck}\n\`\`\``);
  }

  const contextInfo = contextParts.join("\n\n");
    
  console.log(`Context Info generated (${contextInfo.length} chars):\n${contextInfo.substring(0, 500)}...`);

  const systemPrompt = getSystemPrompt("admin", contextInfo);
  // Log the final system prompt (or a snippet)
  console.log(`System Prompt length: ${systemPrompt.length}`);
  console.log(`System Prompt start:\n---\n${systemPrompt.substring(0, 500)}...\n---`);


  // --- Streaming Execution ---

  console.log("Starting streamText with gpt-5...");
  
  const result = streamText({
    model: openai("gpt-5"),
    messages: convertToModelMessages(messages),
    system: systemPrompt,
    tools: tools as Parameters<typeof streamText>[0]["tools"],
    // Enable multi-step agentic execution - AI can chain multiple tool calls
    // stepCountIs(10) allows up to 10 steps: tool calls → process results → more tools → final response
    stopWhen: stepCountIs(10),
    onFinish: async ({ text, toolCalls, toolResults, finishReason, usage }) => {
      console.log("=== STREAM FINISHED ===");
      console.log(`Finish Reason: ${finishReason}`);
      console.log(`Text Content Length: ${text?.length || 0}`);
      console.log(`Text Content: ${text || '[EMPTY]'}`);
      console.log(`Tool Calls Count: ${toolCalls?.length || 0}`);
      if (toolCalls && toolCalls.length > 0) {
        console.log("Tool Calls:");
        for (const call of toolCalls) {
          console.log(`  - ${call.toolName} (ID: ${call.toolCallId})`);
          const argsStr = JSON.stringify((call as any).args || {});
          console.log(`    Args: ${argsStr.substring(0, 200)}`);
        }
      }
      console.log(`Tool Results Count: ${toolResults?.length || 0}`);
      if (toolResults && toolResults.length > 0) {
        console.log("Tool Results:");
        for (const result of toolResults) {
          console.log(`  - Tool: ${result.toolName}`);
          const resultStr = JSON.stringify((result as any).result || {});
          console.log(`    Result: ${resultStr.substring(0, 200)}`);
        }
      }
      console.log(`Usage: ${JSON.stringify(usage)}`);
      console.log("======================");
    },
  });

  return result.toUIMessageStreamResponse();
}