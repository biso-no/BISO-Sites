export { EditorShell } from "./components/editor-shell";
export { useEditorStore } from "./editor/store";
export { useEditorCallbacks, EditorCallbacksContext } from "./editor/callbacks";
export type { EditorCallbacks } from "./editor/callbacks";
export type { PageDoc, PageMeta, Block, BlockType, EditorDepartment, SavingState } from "./editor/types";
export { getBlock, allBlocks, BLOCK_LIBRARY } from "./blocks/registry";

// Side-effect: populate the block registry
import "./blocks/index";
