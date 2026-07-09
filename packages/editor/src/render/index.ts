// Web-safe render barrel: block registry, theme tokens, and the shared editor
// store. Auto-source blocks (events/jobs/news) read the page department from the
// store, so a public renderer must seed it from the page doc. No DnD, no
// inspector UI.
// Import blocks to populate the registry (side effects).
import "../blocks/index";

export { allBlocks, getBlock } from "../blocks/registry";
export { fromJSON } from "../editor/serialize";
export { useEditorStore } from "../editor/store";
export type { Block, BlockType, PageDoc, PageMeta } from "../editor/types";
export type { AccentHue } from "../theme/presets";
export {
  accentForDepartment,
  DEPARTMENT_ACCENTS,
  HUE_COLORS,
} from "../theme/presets";
