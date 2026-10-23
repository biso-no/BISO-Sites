"use client";

import { current } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
  applyAccent as opApplyAccent,
  bindCollection as opBindCollection,
  duplicateBlock as opDuplicate,
  duplicateSection as opDuplicateSection,
  insertBlock as opInsert,
  insertBlockInNewSection as opInsertInNewSection,
  insertSection as opInsertSection,
  moveBlock as opMoveBlock,
  moveBlockToNewSection as opMoveBlockToNewSection,
  moveSection as opMoveSection,
  removeBlock as opRemove,
  removeSection as opRemoveSection,
  setMeta as opSetMeta,
  setProp as opSetProp,
  setSectionAnchor as opSetSectionAnchor,
  setSectionLayout as opSetSectionLayout,
  setVariant as opSetVariant,
} from "./operations";
import {
  defaultInsertTarget,
  findBlock,
  findColumn,
  findSection,
} from "./tree";
import type {
  BlockType,
  EditorLocale,
  EditorMode,
  EditorViewport,
  InsertTarget,
  PageDoc,
  PageMeta,
  SavingState,
  Section,
  SectionColumns,
  SectionLayout,
} from "./types";

const HISTORY_LIMIT = 100;

interface HistorySnap {
  meta: PageMeta;
  sections: Section[];
}

interface EditorState {
  applyAccent: (hex: string) => void;
  bindCollection: (id: string, source: string) => void;
  copilotOpen: boolean;
  doc: PageDoc;
  duplicateBlock: (id: string) => void;
  duplicateSection: (id: string) => void;
  future: HistorySnap[];
  hoveredId: string | null;

  // Document mutations
  /**
   * Insert into `target`, else the pending `insertTarget`, else after the
   * selected block, else a new one-column section at the end. Returns the id.
   */
  insertBlock: (type: BlockType, target?: InsertTarget) => string;
  insertBlockInNewSection: (type: BlockType, sectionIndex: number) => string;
  insertSection: (columns: SectionColumns, sectionIndex: number) => string;
  insertTarget: InsertTarget | null;
  inspectorTab: "block" | "page" | "outline";
  /**
   * Locale the page is being rendered in. Auto-source blocks pass it to their
   * feed endpoints so an English page gets English titles and date formatting
   * rather than the server-side default.
   */
  locale: EditorLocale;
  mode: EditorMode;
  moveBlock: (blockId: string, target: InsertTarget) => void;
  moveBlockToNewSection: (blockId: string, sectionIndex: number) => void;
  moveSection: (id: string, beforeSectionId?: string) => void;
  past: HistorySnap[];
  redo: () => void;
  removeBlock: (id: string) => void;
  removeSection: (id: string) => void;
  saving: SavingState;

  // Selection
  select: (id: string | null) => void;
  selectedSectionId: string | null;

  // UI state
  selection: string | null;
  selectSection: (id: string | null) => void;

  // Copilot
  setCopilotOpen: (open: boolean) => void;

  /** Replace the entire doc (used for initial load). */
  setDoc: (doc: PageDoc) => void;
  setHovered: (id: string | null) => void;
  setInsertTarget: (target: InsertTarget | null) => void;
  setInspectorTab: (tab: "block" | "page" | "outline") => void;
  setLocale: (locale: EditorLocale) => void;
  setMeta: <K extends keyof PageMeta>(key: K, value: PageMeta[K]) => void;

  // Mode / viewport
  setMode: (mode: EditorMode) => void;
  setProp: (id: string, path: string, value: unknown) => void;
  setSaving: (state: SavingState) => void;
  setSectionAnchor: (id: string, anchor: string) => void;
  setSectionLayout: (id: string, patch: Partial<SectionLayout>) => void;
  /** Mirror a publish/unpublish. Not an edit, so it never enters history. */
  setStatus: (status: PageMeta["status"]) => void;
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
    /*
     * Empty, not a sentinel. Auto-source blocks (events/jobs/news) treat this
     * as the department to fetch, and "biso" is not a real department id —
     * departments are numeric. Any render that read the default before the
     * host seeded the store fired a request for a department that cannot
     * exist; an empty value correctly means "no live feed yet".
     */
    department: "",
    accentColor: "#3DA9E0",
    status: "draft",
  },
  sections: [],
  version: 2,
};

function snap(doc: PageDoc): HistorySnap {
  return {
    meta: current(doc.meta) as PageMeta,
    sections: current(doc.sections) as Section[],
  };
}

/** Clear selection state that points at ids missing from the current doc. */
function reconcileSelection(state: {
  doc: PageDoc;
  insertTarget: InsertTarget | null;
  selectedSectionId: string | null;
  selection: string | null;
}) {
  if (state.selection && !findBlock(state.doc, state.selection)) {
    state.selection = null;
  }
  if (
    state.selectedSectionId &&
    !findSection(state.doc, state.selectedSectionId)
  ) {
    state.selectedSectionId = null;
  }
  const target = state.insertTarget;
  if (target) {
    const column = findColumn(state.doc, target.columnId);
    const beforeMissing =
      target.beforeBlockId &&
      !column?.column.blocks.some((b) => b.id === target.beforeBlockId);
    if (!column || beforeMissing) {
      state.insertTarget = null;
    }
  }
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
      selectedSectionId: null,
      insertTarget: null,
      hoveredId: null,
      mode: "edit",
      viewport: "desk",
      saving: "idle",
      copilotOpen: false,
      inspectorTab: "block",
      locale: "no",

      insertBlock: (type, target) => {
        let newId = "";
        set((s) => {
          pushHistory(s);
          const resolved =
            target ?? s.insertTarget ?? defaultInsertTarget(s.doc, s.selection);
          const id = resolved ? opInsert(s.doc, type, resolved) : null;
          // A stale target column falls through to a fresh section.
          newId =
            id ??
            opInsertInNewSection(s.doc, type, s.doc.sections.length).blockId;
          s.insertTarget = null;
          s.selection = newId;
          s.selectedSectionId = null;
        });
        return newId;
      },

      insertBlockInNewSection: (type, sectionIndex) => {
        let newId = "";
        set((s) => {
          pushHistory(s);
          newId = opInsertInNewSection(s.doc, type, sectionIndex).blockId;
        });
        return newId;
      },

      moveBlock: (blockId, target) =>
        set((s) => {
          pushHistory(s);
          opMoveBlock(s.doc, blockId, target);
        }),

      moveBlockToNewSection: (blockId, sectionIndex) =>
        set((s) => {
          pushHistory(s);
          opMoveBlockToNewSection(s.doc, blockId, sectionIndex);
        }),

      insertSection: (columns, sectionIndex) => {
        let newId = "";
        set((s) => {
          pushHistory(s);
          newId = opInsertSection(s.doc, columns, sectionIndex);
        });
        return newId;
      },

      removeSection: (id) =>
        set((s) => {
          pushHistory(s);
          const found = findSection(s.doc, id);
          if (
            found &&
            s.selection &&
            found.section.columns.some((c) =>
              c.blocks.some((b) => b.id === s.selection)
            )
          ) {
            s.selection = null;
          }
          if (s.selectedSectionId === id) {
            s.selectedSectionId = null;
          }
          opRemoveSection(s.doc, id);
        }),

      duplicateSection: (id) =>
        set((s) => {
          pushHistory(s);
          opDuplicateSection(s.doc, id);
        }),

      moveSection: (id, beforeSectionId) =>
        set((s) => {
          pushHistory(s);
          opMoveSection(s.doc, id, beforeSectionId);
        }),

      setSectionLayout: (id, patch) =>
        set((s) => {
          pushHistory(s);
          opSetSectionLayout(s.doc, id, patch);
        }),

      setSectionAnchor: (id, anchor) =>
        set((s) => {
          pushHistory(s);
          opSetSectionAnchor(s.doc, id, anchor);
        }),

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

      setStatus: (status) =>
        set((s) => {
          s.doc.meta.status = status;
        }),

      setDoc: (doc) =>
        set((s) => {
          s.doc = structuredClone(doc);
          s.past = [];
          s.future = [];
          reconcileSelection(s);
        }),

      select: (id) =>
        set((s) => {
          s.selection = id;
          s.selectedSectionId = null;
        }),
      selectSection: (id) =>
        set((s) => {
          s.selectedSectionId = id;
          s.selection = null;
        }),
      setInsertTarget: (target) =>
        set((s) => {
          s.insertTarget = target;
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
      setLocale: (locale) =>
        set((s) => {
          s.locale = locale;
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
          s.doc.sections = entry.sections;
          s.doc.meta = entry.meta;
          reconcileSelection(s);
        }),

      redo: () =>
        set((s) => {
          const entry = s.future.pop();
          if (!entry) {
            return;
          }
          s.past.push(snap(s.doc));
          s.doc.sections = entry.sections;
          s.doc.meta = entry.meta;
          reconcileSelection(s);
        }),
    };
  })
);
