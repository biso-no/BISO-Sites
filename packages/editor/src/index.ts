export { allBlocks, BLOCK_LIBRARY, getBlock } from "./blocks/index";
export { EditorShell } from "./components/editor-shell";
export type { EditorCallbacks } from "./editor/callbacks";
export { EditorCallbacksContext, useEditorCallbacks } from "./editor/callbacks";
export {
  PageFeedProvider,
  usePageFeedSnapshot,
  usePageFeedSource,
} from "./editor/page-feed-context";
export type {
  PageFeedKind,
  PageFeedRequest,
  PageFeedSnapshot,
} from "./editor/page-feeds";
export {
  collectPageFeedRequests,
  pageFeedKey,
  resolveFeedDepartment,
} from "./editor/page-feeds";
export { normalizePageDoc } from "./editor/serialize";
export { useEditorStore } from "./editor/store";
export type {
  Block,
  BlockType,
  EditorDepartment,
  EditorLocale,
  EditorLocaleOption,
  PageDoc,
  PageMeta,
  SavingState,
} from "./editor/types";

// Side-effect: populate the block registry.
//
// The registry re-export above deliberately goes through `./blocks/index`
// rather than `./blocks/registry`, and the package declares
// `"sideEffects": true`. See the longer note in `./render/index.ts` — without
// both, bundlers drop these registrations and every block renders as null.
import "./blocks/index";
