"use client";

import { useEditorStore } from "./store";

export const useMeta = () => useEditorStore((s) => s.doc.meta);
export const useSections = () => useEditorStore((s) => s.doc.sections);
export const useHeader = () => useEditorStore((s) => s.doc.header);
export const useHeaderSelected = () => useEditorStore((s) => s.headerSelected);
export const useSelectedSectionId = () =>
  useEditorStore((s) => s.selectedSectionId);
export const useInsertTarget = () => useEditorStore((s) => s.insertTarget);
export const useSelection = () => useEditorStore((s) => s.selection);
export const useHoveredId = () => useEditorStore((s) => s.hoveredId);
export const useMode = () => useEditorStore((s) => s.mode);
export const useViewport = () => useEditorStore((s) => s.viewport);
export const useSaving = () => useEditorStore((s) => s.saving);
export const useCopilotOpen = () => useEditorStore((s) => s.copilotOpen);
export const useInspectorTab = () => useEditorStore((s) => s.inspectorTab);
