"use client";

import { current } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  applyAccent as opApplyAccent,
  bindCollection as opBindCollection,
  duplicateBlock as opDuplicate,
  insertBlock as opInsert,
  removeBlock as opRemove,
  reorder as opReorder,
  setMeta as opSetMeta,
  setProp as opSetProp,
  setVariant as opSetVariant,
} from "./operations";
import type {
  Block,
  BlockType,
  EditorMode,
  EditorViewport,
  PageDoc,
  PageMeta,
  SavingState,
} from "./types";

const HISTORY_LIMIT = 100;

interface HistorySnap {
  blocks: Block[];
  meta: PageMeta;
}

interface EditorState {
  applyAccent: (hex: string) => void;
  bindCollection: (id: string, source: string) => void;
  copilotOpen: boolean;
  doc: PageDoc;
  duplicateBlock: (id: string) => void;
  future: HistorySnap[];
  hoveredId: string | null;

  // Document mutations
  insertBlock: (type: BlockType, afterId?: string) => string;
  inspectorTab: "block" | "page" | "outline";
  mode: EditorMode;
  past: HistorySnap[];
  redo: () => void;
  removeBlock: (id: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  saving: SavingState;

  // Selection
  select: (id: string | null) => void;

  // UI state
  selection: string | null;

  // Copilot
  setCopilotOpen: (open: boolean) => void;

  /** Replace the entire doc (used for initial load). */
  setDoc: (doc: PageDoc) => void;
  setHovered: (id: string | null) => void;
  setInspectorTab: (tab: "block" | "page" | "outline") => void;
  setMeta: <K extends keyof PageMeta>(key: K, value: PageMeta[K]) => void;

  // Mode / viewport
  setMode: (mode: EditorMode) => void;
  setProp: (id: string, path: string, value: unknown) => void;
  setSaving: (state: SavingState) => void;
  setVariant: (id: string, variant: string) => void;
  setViewport: (viewport: EditorViewport) => void;

  // History
  undo: () => void;
  viewport: EditorViewport;
}

const EMPTY_DOC: PageDoc = {
  meta: {
    title: "Untitled page",
    slug: "untitled",
    department: "biso",
    accentColor: "#6b1e1e",
    status: "draft",
  },
  blocks: [],
};

function snap(doc: PageDoc): HistorySnap {
  return {
    blocks: current(doc.blocks) as Block[],
    meta: current(doc.meta) as PageMeta,
  };
}

export const useEditorStore = create<EditorState>()(
  immer((set, _get) => {
    function pushHistory(state: {
      doc: PageDoc;
      past: HistorySnap[];
      future: HistorySnap[];
    }) {
      state.past.push(snap(state.doc));
      if (state.past.length > HISTORY_LIMIT) {
        state.past.shift();
      }
      state.future = [];
    }

    return {
      doc: structuredClone(EMPTY_DOC),
      past: [],
      future: [],

      selection: null,
      hoveredId: null,
      mode: "edit",
      viewport: "desk",
      saving: "idle",
      copilotOpen: false,
      inspectorTab: "block",

      insertBlock: (type, afterId) => {
        let newId = "";
        set((s) => {
          pushHistory(s);
          newId = opInsert(s.doc, type, afterId);
        });
        return newId;
      },

      removeBlock: (id) =>
        set((s) => {
          pushHistory(s);
          opRemove(s.doc, id);
          if (s.selection === id) {
            s.selection = null;
          }
        }),

      duplicateBlock: (id) =>
        set((s) => {
          pushHistory(s);
          opDuplicate(s.doc, id);
        }),

      setProp: (id, path, value) =>
        set((s) => {
          pushHistory(s);
          opSetProp(s.doc, id, path, value);
        }),

      setVariant: (id, variant) =>
        set((s) => {
          pushHistory(s);
          opSetVariant(s.doc, id, variant);
        }),

      reorder: (fromIndex, toIndex) =>
        set((s) => {
          pushHistory(s);
          opReorder(s.doc, fromIndex, toIndex);
        }),

      bindCollection: (id, source) =>
        set((s) => {
          pushHistory(s);
          opBindCollection(s.doc, id, source);
        }),

      applyAccent: (hex) =>
        set((s) => {
          pushHistory(s);
          opApplyAccent(s.doc, hex);
        }),

      setMeta: (key, value) =>
        set((s) => {
          pushHistory(s);
          opSetMeta(s.doc, key, value);
        }),

      setDoc: (doc) =>
        set((s) => {
          s.doc = structuredClone(doc);
          s.past = [];
          s.future = [];
        }),

      select: (id) =>
        set((s) => {
          s.selection = id;
        }),
      setHovered: (id) =>
        set((s) => {
          s.hoveredId = id;
        }),
      setMode: (mode) =>
        set((s) => {
          s.mode = mode;
        }),
      setViewport: (viewport) =>
        set((s) => {
          s.viewport = viewport;
        }),
      setCopilotOpen: (open) =>
        set((s) => {
          s.copilotOpen = open;
        }),
      setInspectorTab: (tab) =>
        set((s) => {
          s.inspectorTab = tab;
        }),
      setSaving: (state) =>
        set((s) => {
          s.saving = state;
        }),

      undo: () =>
        set((s) => {
          const entry = s.past.pop();
          if (!entry) {
            return;
          }
          s.future.push(snap(s.doc));
          s.doc.blocks = entry.blocks;
          s.doc.meta = entry.meta;
        }),

      redo: () =>
        set((s) => {
          const entry = s.future.pop();
          if (!entry) {
            return;
          }
          s.past.push(snap(s.doc));
          s.doc.blocks = entry.blocks;
          s.doc.meta = entry.meta;
        }),
    };
  })
);
