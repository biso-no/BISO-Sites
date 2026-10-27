// Import each block to trigger registerBlock() side effects.
// Keep this list in sync with the block directories.
import "./marquee/index";
import "./text/index";
import "./heading/index";
import "./quote/index";
import "./callout/index";
import "./team/index";
import "./stats/index";
import "./highlights/index";
import "./facts/index";
import "./divider/index";
import "./timeline/index";
import "./cards/index";
import "./image/index";
import "./gallery/index";
import "./video/index";
import "./events/index";
import "./jobs/index";
import "./news/index";
import "./buttons/index";
import "./ctaBand/index";
import "./faq/index";
import "./contact/index";
import "./signup/index";
import "./partners/index";
import "./tabs/index";
import "./departmentGrid/index";
import "./documents/index";
import "./stepGrid/index";
import "./productGrid/index";
import "./multiStepForm/index";

export { allBlocks, getBlock, paletteGroups } from "./registry";
export type { BlockDefinition, PaletteGroup, PatchFn } from "./types";
