/**
 * Streaming API Route for AI Page Generation
 *
 * Uses json-render's generateCatalogPrompt to create guardrailed
 * AI generation that streams JSONL patches for real-time updates.
 */

import { openai } from "@ai-sdk/openai";
import { generateCatalogPrompt } from "@json-render/core";
import { puckCatalog } from "@repo/editor/catalog";
import { puckDataToTree } from "@repo/editor/tree-to-puck";
import { streamText } from "ai";

export async function POST(req: Request) {
  try {
    const { prompt, currentData, selectedBlockIndex } = await req.json();

    // Generate the catalog prompt for AI guardrails
    const catalogPrompt = generateCatalogPrompt(puckCatalog);

    // Convert current Puck data to tree format for context
    const currentTree = currentData ? puckDataToTree(currentData) : null;

    // Build context about current page and selection
    const contextPrompt = buildContextPrompt(currentTree, selectedBlockIndex);

    // System prompt combining catalog and context
    const systemPrompt = `${catalogPrompt}

${contextPrompt}

## Output Format
Generate JSONL (JSON Lines) where each line is a patch operation:
- {"op":"add","path":"/content","value":{...block...}} - Add a new block
- {"op":"replace","path":"/content/N","value":{...block...}} - Replace block at index N
- {"op":"set","path":"/content/N/props/title","value":"New Title"} - Update a specific prop

Each block must have a unique "id" in props (e.g., "Hero-1", "FeatureGrid-2").

## Important Rules
1. Only use components defined in the catalog above
2. Each patch operation must be a valid JSON object on its own line
3. When adding multiple blocks, emit one patch per block
4. When modifying existing content, preserve blocks not being changed
5. Always include complete, valid props for each component
6. Every block value MUST include a "type" field (e.g., "type": "Hero")
7. Every button "href" field MUST be a non-empty string — use "#" as placeholder if no real URL is known`;

    const result = streamText({
      model: openai("gpt-5-mini"),
      system: systemPrompt,
      prompt,
    });

    // Return streaming response
    return new Response(result.textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[generate-page] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate page content" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

/**
 * Build context prompt based on current page state and selection
 */
function buildContextPrompt(
  currentTree: ReturnType<typeof puckDataToTree> | null,
  selectedBlockIndex?: number
): string {
  if (!currentTree || Object.keys(currentTree.elements).length <= 1) {
    return `## Current State
This is a NEW page with no existing content.
Generate a complete page layout based on the user's request.`;
  }

  // Get block count (excluding root)
  const blockCount = Object.keys(currentTree.elements).length - 1;

  let contextPrompt = `## Current Page State
The page has ${blockCount} existing block(s).

Current structure (in order):
`;

  // List current blocks
  const rootElement = currentTree.elements[currentTree.root];
  if (rootElement?.children) {
    rootElement.children.forEach((childKey, index) => {
      const element = currentTree.elements[childKey];
      if (element) {
        contextPrompt += `${index}: ${element.type} (id: ${element.key})\n`;
      }
    });
  }

  // Add selection context
  if (selectedBlockIndex !== undefined && selectedBlockIndex >= 0) {
    contextPrompt += `
## User Selection
Block at index ${selectedBlockIndex} is currently SELECTED.
If the user says "this", "this section", "replace this", or similar, they mean the block at index ${selectedBlockIndex}.
Use path "/content/${selectedBlockIndex}" for replace operations on the selected block.
Use path "/content/${selectedBlockIndex}/props/..." to modify specific props of the selected block.`;
  } else {
    contextPrompt += `
## No Selection
No block is selected. The user likely wants to:
- Add new content to the page
- Modify multiple blocks
- Replace the entire page layout`;
  }

  return contextPrompt;
}
