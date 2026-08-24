// Web-safe render barrel: block registry, theme tokens, and the shared editor
// store. Auto-source blocks (events/jobs/news) read the page department from the
// store, so a public renderer must seed it from the page doc. No DnD, no
// inspector UI.
// Import blocks to populate the registry (side effects).
//
// This import is load-bearing and fragile: the whole block library registers
// itself by evaluation, so a bundler that decides the import is dead silently
// yields an empty registry and every block renders as null. Two things keep it
// alive, and BOTH are needed:
//   1. `@repo/editor` declares `"sideEffects": true`. The previous glob list
//      did not match under Turbopack, which dropped the registrations from the
//      browser bundle — SSR emitted the blocks and hydration then deleted them.
//   2. `getBlock`/`allBlocks` are re-exported through `../blocks/index` (not
//      `../blocks/registry`), so reading the registry is a value dependency on
//      the registrations rather than an unrelated module.
import "../blocks/index";

export type { ResolvedBackground } from "../blocks/_primitives/layout-types";
export { resolveBackgrounds } from "../blocks/_primitives/resolve-layout";
export { allBlocks, getBlock } from "../blocks/index";
export { fromJSON, normalizePageDoc } from "../editor/serialize";
export { useEditorStore } from "../editor/store";
export type { Block, BlockType, PageDoc, PageMeta } from "../editor/types";
export type { AccentHue } from "../theme/presets";
export {
  accentForDepartment,
  DEPARTMENT_ACCENTS,
  HUE_COLORS,
} from "../theme/presets";
