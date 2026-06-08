"use client";

import { useEditorStore } from "./store";

export const useMeta = () => useEditorStore((s) => s.doc.meta);
export const useBlocks = () => useEditorStore((s) => s.doc.blocks);
export const useSelection = () => useEditorStore((s) => s.selection);
export const useHoveredId = () => useEditorStore((s) => s.hoveredId);
export const useMode = () => useEditorStore((s) => s.mode);
export const useViewport = () => useEditorStore((s) => s.viewport);
export const useSaving = () => useEditorStore((s) => s.saving);
export const useCopilotOpen = () => useEditorStore((s) => s.copilotOpen);
export const useInspectorTab = () => useEditorStore((s) => s.inspectorTab);
