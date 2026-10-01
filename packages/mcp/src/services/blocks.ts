/**
 * The block catalogue.
 *
 * The editor's block definitions live in `packages/editor/src/blocks/<type>/index.tsx`
 * next to their React `Render`, `Inspector` and `PaletteThumb` components, so
 * importing the registry would pull React, `@repo/ui`, `zustand` and `@dnd-kit`
 * into this process — and the registry's entries hold live component
 * references, which are not serialisable anyway. The metadata is therefore
 * restated here as plain data.
 *
 * Restated data drifts, so it is pinned two ways:
 *
 * 1. `satisfies readonly BlockType[]` rejects any entry that is not a real
 *    block type.
 * 2. `AssertExhaustive` below fails to compile if a block type exists in
 *    `@repo/editor/types` that this catalogue omits.
 *
 * Both are type-level, so adding a block to the editor without adding it here
 * breaks `check-types` rather than silently shipping a catalogue that is short
 * a block.
 *
 * Worth noting for contrast: the editor's own AI tool list
 * (`packages/editor/src/ai/tools/index.ts`) is `as const satisfies readonly
 * BlockType[]` but lists only 19 of the 33 types, so its copilot cannot insert
 * `featureGrid`, `productGrid`, `multiStepForm` and eleven others. It has the
 * first guard and not the second.
 */

import type { BlockType } from "@repo/editor/types";

export const BLOCK_TYPES = [
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
  "featureGrid",
  "partners",
  "linkTileGrid",
  "tabs",
  "departmentGrid",
  "documents",
  "featuredCards",
  "campusSelector",
  "stepGrid",
  "scrollRow",
  "productGrid",
  "filterBar",
  "profileHeader",
  "multiStepForm",
] as const satisfies readonly BlockType[];

/**
 * Compile-time proof that the catalogue covers every block type.
 *
 * If `BlockType` gains a member that is missing above, `Missing` stops being
 * `never` and this alias fails to resolve to `true`.
 */
type Missing = Exclude<BlockType, (typeof BLOCK_TYPES)[number]>;
type AssertExhaustive<T extends never> = T;
export type _BlockCatalogueIsExhaustive = AssertExhaustive<Missing>;

/**
 * Declared layout variants, for the nine blocks that have them.
 *
 * Other blocks may carry a `variant` field with no registry entry behind it;
 * setting one on those is accepted by the document but renders nothing special.
 */
const VARIANTS: Partial<Record<BlockType, readonly string[]>> = {
  hero: ["split", "centered", "full"],
  cta: ["card", "banner", "gradient"],
  twoCol: ["equal", "leftWide", "rightWide"],
  faq: ["list", "accordion-themed"],
  contact: ["single", "directory"],
  tabs: ["pills", "underline", "cards"],
  featureGrid: ["bordered", "cards", "minimal"],
  departmentGrid: ["grid", "list"],
  campusSelector: ["switcher", "cards"],
};

/**
 * Blocks that render rows from Appwrite rather than from the document.
 *
 * Mirrors `requestForBlock` in `@repo/editor/page-feeds`: only these five bind
 * a feed, and `partners` only when its `source` is `"auto"`.
 */
export const FEED_BINDING_BLOCKS = [
  {
    type: "events",
    feed: "events",
    scope:
      "The page's own department, or an explicit department id in `source`.",
  },
  {
    type: "jobs",
    feed: "jobs",
    scope:
      "The page's own department, or an explicit department id in `source`.",
  },
  {
    type: "news",
    feed: "news",
    scope:
      "The page's own department, or an explicit department id in `source`.",
  },
  {
    type: "partners",
    feed: "partners",
    scope:
      "National partners. Only when `source` is `auto`; `manual` renders the authored logos instead.",
  },
  {
    type: "departmentGrid",
    feed: "departments",
    scope: "All publicly listed units; not department-scoped.",
  },
] as const;

export interface BlockTypeInfo {
  bindsFeed: boolean;
  type: BlockType;
  variants: readonly string[];
}

export const BLOCK_TYPE_CATALOG: readonly BlockTypeInfo[] = BLOCK_TYPES.map(
  (type) => ({
    type,
    variants: VARIANTS[type] ?? [],
    bindsFeed: FEED_BINDING_BLOCKS.some((entry) => entry.type === type),
  })
);

export function isKnownBlockType(value: string): value is BlockType {
  return (BLOCK_TYPES as readonly string[]).includes(value);
}
