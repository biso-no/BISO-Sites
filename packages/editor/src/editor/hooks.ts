"use client";

import { useEditorStore } from "./store";
import type { Block } from "./types";

export const useDoc = () => useEditorStore((s) => s.doc);
export const useMeta = () => useEditorStore((s) => s.doc.meta);
export const useBlocks = () => useEditorStore((s) => s.doc.blocks);
export const useBlock = (id: string) =>
  useEditorStore(
    (s) => s.doc.blocks.find((b) => b.id === id) as Block | undefined
  );
export const useSelection = () => useEditorStore((s) => s.selection);
export const useHoveredId = () => useEditorStore((s) => s.hoveredId);
export const useMode = () => useEditorStore((s) => s.mode);
export const useViewport = () => useEditorStore((s) => s.viewport);
export const useSaving = () => useEditorStore((s) => s.saving);
export const useCanUndo = () => useEditorStore((s) => s.past.length > 0);
export const useCanRedo = () => useEditorStore((s) => s.future.length > 0);
export const useCopilotOpen = () => useEditorStore((s) => s.copilotOpen);
export const useInspectorTab = () => useEditorStore((s) => s.inspectorTab);
