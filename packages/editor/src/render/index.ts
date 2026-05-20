// Web-safe render barrel: block registry + theme tokens only.
// No Zustand, no DnD, no inspector, no editor store.
// Import blocks to populate the registry (side effects).
import "../blocks/index";

export { allBlocks, getBlock } from "../blocks/registry";
export { fromJSON } from "../editor/serialize";
export type { Block, BlockType, PageDoc, PageMeta } from "../editor/types";
export type { AccentHue } from "../theme/presets";
export {
  accentForDepartment,
  DEPARTMENT_ACCENTS,
  HUE_COLORS,
} from "../theme/presets";
