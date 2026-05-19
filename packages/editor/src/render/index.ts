// Web-safe render barrel: block registry + theme tokens only.
// No Zustand, no DnD, no inspector, no editor store.
// Import blocks to populate the registry (side effects).
import "../blocks/index";

export { getBlock, allBlocks } from "../blocks/registry";
export { DEPARTMENT_ACCENTS, HUE_COLORS, accentForDepartment } from "../theme/presets";
export type { AccentHue } from "../theme/presets";
export type { PageDoc, PageMeta, Block, BlockType } from "../editor/types";
export { fromJSON } from "../editor/serialize";
