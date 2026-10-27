import { tool } from "ai";
import { z } from "zod";
import { paletteGroups } from "@/blocks/index";
import type { PaletteGroupData } from "@/blocks/registry";
import { COLUMN_COUNT } from "@/editor/sections";
import type { BlockType, SectionColumns } from "@/editor/types";
import { validateSetTheme } from "./theme";

// COLUMN_COUNT is a Record<SectionColumns, number>, so its keys are exactly the presets.
const SECTION_COLUMNS = Object.keys(COLUMN_COUNT) as [
  SectionColumns,
  ...SectionColumns[],
];
const SECTION_BACKGROUNDS = ["white", "tinted", "dark", "photo"] as const;

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
  insert_section: tool({
    description:
      "Insert a new, empty section (a row of columns) on the page. Presets: 1 = one column, " +
      "1-1 = two equal, 2-1 = wide then narrow, 1-2 = narrow then wide, 1-1-1 = three, 1-1-1-1 = four. " +
      'Then fill it with insert_block, passing sectionId "new" (the section you just made) and a columnIndex.',
    inputSchema: z.object({
      columns: z.enum(SECTION_COLUMNS).describe("The column preset"),
      background: z
        .enum(SECTION_BACKGROUNDS)
        .optional()
        .describe(
          "Section background. Photo needs an uploaded image, so avoid it."
        ),
      afterSectionId: z
        .string()
        .optional()
        .describe("Insert after this section ID. Omit to append at the end."),
    }),
    execute: ({ columns, afterSectionId }) => ({
      status: "applied",
      message: `Inserted a ${columns} section${afterSectionId ? ` after ${afterSectionId}` : " at the end"}. Use sectionId "new" to fill it.`,
    }),
  }),

  insert_block: tool({
    description:
      "Insert a new block onto the page. Without a target it goes in a new section at the end. " +
      "Give sectionId (and columnIndex, 0-based, default 0) to put it in a column of an existing section, " +
      "or afterBlockId to place it right after another block.",
    inputSchema: z.object({
      type: z.enum(BLOCK_TYPES).describe("The block type to insert"),
      sectionId: z
        .string()
        .optional()
        .describe(
          'Section to insert into. "new" means the section insert_section just made.'
        ),
      columnIndex: z
        .number()
        .optional()
        .describe(
          "0-based column within sectionId. Must exist in the section's layout."
        ),
      afterBlockId: z
        .string()
        .optional()
        .describe("Insert after this block ID."),
    }),
    execute: ({ type, sectionId, columnIndex, afterBlockId }) => {
      let where = "at the end";
      if (afterBlockId) {
        where = `after ${afterBlockId}`;
      } else if (sectionId) {
        where = `in ${sectionId} column ${columnIndex ?? 0}`;
      }
      return { status: "applied", message: `Inserted ${type} block ${where}` };
    },
  }),

  set_theme: tool({
    description:
      "Set the page's colours: dark (headings and dark sections, must be dark enough for white text, 7:1) and " +
      "accent (must reach 4.5:1 on the dark). Both are hex. A pair that fails is refused with the nearest " +
      "passing shade; retry with that. { reset: true } returns the page to BISO's colours.",
    inputSchema: z.union([
      z.object({
        dark: z.string().describe("Dark colour, hex like #001a35"),
        accent: z.string().describe("Accent colour, hex like #3aa3e1"),
      }),
      z.object({ reset: z.literal(true) }),
    ]),
    execute: (input) => {
      const checked = validateSetTheme(input);
      return "error" in checked
        ? checked.error
        : { status: "applied", message: "Theme set." };
    },
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
      "Bind a data block (events, jobs, news) to a department's data. " +
      "The block will show that department's live items.",
    inputSchema: z.object({
      id: z.string().describe("Block ID (must be type: events | jobs | news)"),
      source: z
        .string()
        .describe(
          "Department id (not a collection id), or 'auto' for the default"
        ),
    }),
    execute: ({ id, source }) => ({
      status: "applied",
      message: `Bound ${id} to department ${source}`,
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
