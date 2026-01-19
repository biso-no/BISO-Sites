import { tool } from "ai";
import { z } from "zod";

/**
 * Schema for Puck content generation
 */
const puckContentSchema = z.object({
  content: z
    .array(
      z.object({
        type: z.string().describe("Component type (e.g., Hero, FeatureGrid)"),
        props: z
          .record(z.string(), z.unknown())
          .describe("Component props including unique id"),
      })
    )
    .describe("Array of page blocks to render"),
  root: z
    .object({
      props: z.record(z.string(), z.unknown()).optional(),
    })
    .optional()
    .describe("Root page configuration"),
});

type PuckContentParams = z.infer<typeof puckContentSchema>;

/**
 * Create a Puck content generator tool
 * This allows the AI to generate complete page layouts in Puck JSON format
 */
export function createPuckGeneratorTool(componentSchemas: string) {
  return tool({
    description: `Generate page content in Puck JSON format. ${componentSchemas}

IMPORTANT RULES:
1. Each component MUST have a unique 'id' in props (e.g., "Hero-1", "FeatureGrid-2")
2. Generate complete, valid props for each component based on the schema
3. Use appropriate component types for the requested content
4. Ensure all required fields are populated
5. The content array defines the page structure from top to bottom`,
    inputSchema: puckContentSchema,
    execute: ({ content, root }: PuckContentParams) => {
      // Validate that all components have IDs
      const missingIds = content.filter(
        (block) => !block.props || typeof block.props.id !== "string"
      );

      if (missingIds.length > 0) {
        return {
          success: false,
          error: `${missingIds.length} component(s) missing required 'id' prop`,
        };
      }

      // Check for duplicate IDs
      const ids = content.map((block) => block.props.id as string);
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

      if (duplicates.length > 0) {
        return {
          success: false,
          error: `Duplicate component IDs found: ${duplicates.join(", ")}`,
        };
      }

      return {
        success: true,
        data: {
          content,
          root: root || { props: {} },
        },
        message: `Generated ${content.length} page component(s)`,
      };
    },
  });
}

/**
 * Schema for analyzing user intent and determining required actions
 */
const taskAnalysisSchema = z.object({
  intent: z
    .enum([
      "create_page",
      "edit_page",
      "create_event",
      "create_product",
      "create_post",
      "navigate",
      "query",
      "other",
    ])
    .describe("The primary intent of the user's request"),
  entityType: z
    .string()
    .optional()
    .describe("Type of entity (page, event, product, etc.)"),
  requiresNavigation: z
    .boolean()
    .describe("Whether navigation to a different page is needed"),
  targetPath: z
    .string()
    .optional()
    .describe("The path to navigate to if navigation is required"),
  requiresContentGeneration: z
    .boolean()
    .describe("Whether AI content generation is needed"),
  contentType: z
    .enum(["puck_page", "form_fields", "none"])
    .describe("Type of content to generate"),
  userProvidedDetails: z
    .record(z.string(), z.string())
    .optional()
    .describe("Key details extracted from user's request"),
  missingInformation: z
    .array(z.string())
    .optional()
    .describe("Information needed from user to complete the task"),
});

type TaskAnalysisParams = z.infer<typeof taskAnalysisSchema>;

/**
 * Create a task analysis tool
 * This helps the AI understand user intent and plan the workflow
 */
export function createTaskAnalyzerTool() {
  return tool({
    description: `Analyze the user's request to determine intent and required actions.
Use this tool FIRST to understand what the user wants before taking any action.
This helps plan the workflow: navigation → content generation → execution`,
    inputSchema: taskAnalysisSchema,
    execute: (analysis: TaskAnalysisParams) => ({
      success: true,
      analysis,
      message: `Task identified: ${analysis.intent}${analysis.requiresNavigation ? " (navigation required)" : ""}${analysis.requiresContentGeneration ? " (content generation required)" : ""}`,
    }),
  });
}
