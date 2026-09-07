import { tool } from "ai";
import { z } from "zod";
import type { BlockType } from "@/editor/types";
import { BRAND_ACCENT_VALUES } from "@/theme/presets";

const BLOCK_TYPES = [
  "hero",
  "marquee",
  "text",
  "quote",
  "callout",
  "twoCol",
  "team",
  "stats",
  "timeline",
  "image",
  "gallery",
  "video",
  "events",
  "jobs",
  "news",
  "cta",
  "faq",
  "contact",
  "signup",
] as const satisfies readonly BlockType[];

/** Input schema for `apply_accent` — exported so the brand-swatch guard can be
 *  asserted directly (a tool's `inputSchema` is widened to `FlexibleSchema`). */
export const applyAccentInputSchema = z.object({
  hex: z.enum(BRAND_ACCENT_VALUES).describe("Approved brand accent colour"),
});

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

  set_variant: tool({
    description:
      "Change the layout variant of a block (e.g. split/centered/full for a hero block).",
    inputSchema: z.object({
      id: z.string().describe("Block ID"),
      variant: z
        .string()
        .describe("Variant name, e.g. 'split', 'centered', 'full'"),
    }),
    execute: ({ id, variant }) => ({
      status: "applied",
      message: `Set variant of ${id} to ${variant}`,
    }),
  }),

  apply_accent: tool({
    description:
      "Change the page accent colour (used for headings, highlights, and the block selection outline). " +
      "Use one of the brand hues: blue=#3DA9E0, navy=#001731, sky=#7CC7EC, gold=#F7D64A, slate=#33566F.",
    inputSchema: applyAccentInputSchema,
    execute: ({ hex }) => ({
      status: "applied",
      message: `Set accent to ${hex}`,
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
        .describe("What the copy is for (e.g. 'hero title for ESN Oslo')"),
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
