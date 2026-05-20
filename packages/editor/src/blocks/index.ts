// Import each block to trigger registerBlock() side effects.
// Keep this list in sync with the block directories.
import "./hero/index";
import "./marquee/index";
import "./text/index";
import "./quote/index";
import "./callout/index";
import "./twoCol/index";
import "./team/index";
import "./stats/index";
import "./timeline/index";
import "./image/index";
import "./gallery/index";
import "./video/index";
import "./events/index";
import "./jobs/index";
import "./news/index";
import "./cta/index";
import "./faq/index";
import "./contact/index";
import "./signup/index";
import "./featureGrid/index";
import "./partners/index";
import "./linkTileGrid/index";
import "./tabs/index";
import "./departmentGrid/index";
import "./documents/index";
import "./featuredCards/index";
import "./campusSelector/index";
import "./stepGrid/index";
import "./scrollRow/index";
import "./productGrid/index";
import "./filterBar/index";
import "./profileHeader/index";
import "./multiStepForm/index";

export { getBlock, allBlocks, BLOCK_LIBRARY } from "./registry";
export type { BlockDefinition, PatchFn } from "./types";
