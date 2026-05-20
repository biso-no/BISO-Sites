export { allBlocks, BLOCK_LIBRARY, getBlock } from "./blocks/registry";
export { EditorShell } from "./components/editor-shell";
export type { EditorCallbacks } from "./editor/callbacks";
export { EditorCallbacksContext, useEditorCallbacks } from "./editor/callbacks";
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

// Side-effect: populate the block registry
import "./blocks/index";
