import { tool } from "ai";
import { z } from "zod";
import { paletteGroups } from "@/blocks/index";
import type { PaletteGroupData } from "@/blocks/registry";
import type { BlockType } from "@/editor/types";

/**
 * The block types a set of palette groups offers, as the non-empty tuple
 * `z.enum` needs. Throws when there are none: that means the registrations
 * never ran here (for instance a `blocks/<name>/index.tsx` marked
 * "use client", which a server route imports only as a client reference),
 * and an empty enum would silently stop the AI from inserting any block.
 */
export function blockTypesOf(
  groups: PaletteGroupData[]
): [BlockType, ...BlockType[]] {
  const [first, ...rest] = groups.flatMap((group) =>
    group.items.map((item) => item.type)
  );
  if (first === undefined) {
    throw new Error(
      'No block types are registered: import @/blocks/index before the AI tools, and keep every blocks/<name>/index.tsx free of "use client".'
    );
  }
  return [first, ...rest];
}

/**
 * Every block type the palette offers, derived from the registry so the AI can
 * never insert a hidden (cut) block or miss a new one.
 */
export const BLOCK_TYPES = blockTypesOf(paletteGroups());

/** Server-side tool definitions for the AI route handler.
 *  Each tool's execute() is advisory — the actual mutations happen on the client
 *  via the store's operations (see ai/client.ts onToolCall). */
export const pageEditorTools = {
  insert_block: tool({
    description:
      "Insert a new block onto the page. Use this to add new content sections.",
    inputSchema: z.object({
      type: z.enum(BLOCK_TYPES).describe("The block type to insert"),
      afterId: z
        .string()
        .optional()
        .describe("Insert after this block ID. Omit to append at the end."),
    }),
    execute: ({ type, afterId }) => ({
      status: "applied",
      message: `Inserted ${type} block${afterId ? ` after ${afterId}` : " at end"}`,
    }),
  }),

  remove_block: tool({
    description: "Remove a block from the page by its ID.",
    inputSchema: z.object({
      id: z.string().describe("The block ID to remove"),
    }),
    execute: ({ id }) => ({
      status: "applied",
      message: `Removed block ${id}`,
    }),
  }),

  set_prop: tool({
    description:
      "Set a property on a block. Use dot notation for nested paths, e.g. 'items.0.label'. " +
      "Check the current page state for available props per block type.",
    inputSchema: z.object({
      id: z.string().describe("Block ID to update"),
      path: z
        .string()
        .describe(
          "Dot-notation property path, e.g. 'title' or 'items.0.label'"
        ),
      value: z.unknown().describe("The new value"),
    }),
    execute: ({ id, path }) => ({
      status: "applied",
      message: `Set ${path} on ${id}`,
    }),
  }),

  bind_collection: tool({
    description:
      "Bind a data block (events, jobs, news) to an Appwrite collection. " +
      "The block will fetch live data from that collection.",
    inputSchema: z.object({
      id: z.string().describe("Block ID (must be type: events | jobs | news)"),
      source: z
        .string()
        .describe("Appwrite collection ID or 'auto' for default"),
    }),
    execute: ({ id, source }) => ({
      status: "applied",
      message: `Bound ${id} to collection ${source}`,
    }),
  }),

  generate_copy: tool({
    description:
      "Generate text content for a specific field and return it as a suggestion. " +
      "Combine with set_prop to apply the generated text.",
    inputSchema: z.object({
      context: z
        .string()
        .describe("What the copy is for (e.g. 'intro paragraph for ESN Oslo')"),
      tone: z
        .enum(["formal", "friendly", "direct"])
        .optional()
        .describe("Desired tone"),
      maxWords: z.number().optional().describe("Approximate word limit"),
    }),
    execute: ({ context, tone = "friendly", maxWords = 20 }) => ({
      status: "generated",
      suggestion: `[AI-generated copy for: ${context} (${tone}, ≤${maxWords} words) — apply via set_prop]`,
    }),
  }),

  list_blocks: tool({
    description:
      "Read-only: return the current list of blocks on the page with their IDs, types, and key props. " +
      "Use this when you need to check what's on the page before making changes.",
    inputSchema: z.object({}),
    execute: () => ({
      status: "info",
      note: "Use the page context in your system prompt instead.",
    }),
  }),
} as const;

export type PageEditorToolName = keyof typeof pageEditorTools;
