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
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
// Removed config import - using hardcoded schema instead to avoid client/server boundary issues

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
  currentPath?: string;
  puckData?: unknown;
};

export async function POST(req: Request) {
  console.log("--- AI Chat API Request Received ---");
  
  const { messages, formContext, currentPath, puckData }: RequestBody =
    await req.json();
    
  // Log request inputs
  console.log(`Input messages count: ${messages.length}`);
  console.log(`Current Path: ${currentPath}`);
  console.log(`Form Context present: ${!!formContext}`);
  if (formContext) {
      console.log(`  Form ID: ${formContext.formId}, Fields count: ${formContext.fields.length}`);
  }
  console.log(`Puck Data present (Editor mode): ${!!puckData}`);

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

  // Create form filler tool
  let formFieldsForTool;
  if (formContext) {
      formFieldsForTool = formContext.fields.map((f) => ({
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
      console.log(`Form filler tool initialized with ${formFieldsForTool.length} fields from formContext.`);
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

  // Build enhanced system prompt with context
  const contextInfo = [
    currentPath ? `Current page: ${currentPath}` : null,
    puckData ? "User is on a Puck editor page" : null,
  ]
    .filter(Boolean)
    .join("\n");
    
  console.log(`Context Info generated:\n${contextInfo || '[None]'}`);

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