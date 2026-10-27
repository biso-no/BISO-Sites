"use client";

import { type PageTheme, sameTheme } from "@repo/shared/utils/page-theme";
import { current } from "immer";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { emptyHeader } from "../header/empty-header";
import {
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
  removeHeader as opRemoveHeader,
  removeSection as opRemoveSection,
  setHeader as opSetHeader,
  setHeaderProp as opSetHeaderProp,
  setMeta as opSetMeta,
  setProp as opSetProp,
  setSectionAnchor as opSetSectionAnchor,
  setSectionLayout as opSetSectionLayout,
  setTheme as opSetTheme,
} from "./operations";
import {
  defaultInsertTarget,
  findBlock,
  findColumn,
  findSection,
  targetInSection,
} from "./tree";
import type {
  BlockType,
  EditorLocale,
  EditorMode,
  EditorViewport,
  InsertTarget,
  PageDoc,
  PageHeader,
  PageMeta,
  SavingState,
  Section,
  SectionColumns,
  SectionLayout,
  StoredMeta,
} from "./types";

const HISTORY_LIMIT = 100;

interface HistorySnap {
  header: PageHeader | undefined;
  meta: PageMeta;
  sections: Section[];
}

interface EditorState {
  /** Give the page an empty header titled after it, if it has none, and select it. */
  addHeader: () => void;
  /**
   * The server stored `stored` where the editor sent `sent` (a unique slug,
   * the department a page was bound to). Not an edit: no undo step. The page
   * and every undo step still holding the sent value take the stored one, so
   * undo cannot send the old value again; a value typed since stays.
   */
  adoptStoredMeta: (sent: StoredMeta, stored: StoredMeta) => void;
  bindCollection: (id: string, source: string) => void;
  copilotOpen: boolean;
  doc: PageDoc;
  /**
   * The department has `theme` now (a publish copied it, or a save found it
   * there already): remove it from the page and from every undo step holding
   * it, so the page follows its department and undo cannot bring back
   * colours the department owns. Only while the page still holds `theme`: a
   * theme picked since the save or publish went out is the editor's own, and
   * stays with every step. Not an edit: no undo step.
   */
  dropPageTheme: (theme: PageMeta["theme"]) => void;
  duplicateBlock: (id: string) => void;
  duplicateSection: (id: string) => void;
  future: HistorySnap[];
  /**
   * The page header is selected. Exclusive with `selection` and
   * `selectedSectionId`: selecting either clears it.
   */
  headerSelected: boolean;
  hoveredId: string | null;

  // Document mutations
  /**
   * Insert into `target`, else the pending `insertTarget`, else the selected
   * section (its first empty column, else the end of its last), else after
   * the selected block, else a new one-column section at the end. Returns
   * the id.
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
  removeHeader: () => void;
  removeSection: (id: string) => void;
  saving: SavingState;

  // Selection
  select: (id: string | null) => void;
  selectedSectionId: string | null;
  selectHeader: () => void;

  // UI state
  selection: string | null;
  selectSection: (id: string | null) => void;

  // Copilot
  setCopilotOpen: (open: boolean) => void;

  /** Replace the entire doc (used for initial load). */
  setDoc: (doc: PageDoc) => void;
  setHeaderProp: (path: string, value: unknown) => void;
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
  /**
   * Mirror a publish/unpublish. Not an edit, so it never enters history; every
   * undo and redo step takes it too, so neither can revert it.
   */
  setStatus: (status: PageMeta["status"]) => void;
  /** One undo step per call; `null` resets to BISO. */
  setTheme: (theme: PageTheme | null) => void;
  /**
   * Live colours while a picker is dragged. Transient: not in the doc, not in
   * history and not saved, so the canvas repaints without an undo step per
   * pointer move. `null` ends the preview.
   */
  setThemePreview: (theme: PageTheme | null) => void;
  setViewport: (viewport: EditorViewport) => void;

  /** See `setThemePreview`. The canvas prefers it over the doc's theme. */
  themePreview: PageTheme | null;

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
    status: "draft",
  },
  sections: [],
  version: 2,
};

/** Everything that holds a meta: the page and each undo and redo step. */
function metaHolders(state: {
  doc: PageDoc;
  future: HistorySnap[];
  past: HistorySnap[];
}): { meta: PageMeta }[] {
  return [state.doc, ...state.past, ...state.future];
}

const STORED_META_KEYS = ["department", "slug"] as const;

function snap(doc: PageDoc): HistorySnap {
  return {
    header: doc.header ? (current(doc.header) as PageHeader) : undefined,
    meta: current(doc.meta) as PageMeta,
    sections: current(doc.sections) as Section[],
  };
}

function restore(doc: PageDoc, entry: HistorySnap): void {
  doc.header = entry.header;
  doc.meta = entry.meta;
  doc.sections = entry.sections;
}

/** Clear selection state that points at things missing from the current doc. */
function reconcileSelection(state: {
  doc: PageDoc;
  headerSelected: boolean;
  insertTarget: InsertTarget | null;
  selectedSectionId: string | null;
  selection: string | null;
}) {
  if (state.headerSelected && !state.doc.header) {
    state.headerSelected = false;
  }
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
      headerSelected: false,
      insertTarget: null,
      hoveredId: null,
      mode: "edit",
      viewport: "desk",
      saving: "idle",
      themePreview: null,
      copilotOpen: false,
      inspectorTab: "block",
      locale: "no",

      insertBlock: (type, target) => {
        let newId = "";
        set((s) => {
          pushHistory(s);
          const sectionTarget =
            !s.selection && s.selectedSectionId
              ? targetInSection(s.doc, s.selectedSectionId)
              : null;
          const resolved =
            target ??
            s.insertTarget ??
            sectionTarget ??
            defaultInsertTarget(s.doc, s.selection);
          const id = resolved ? opInsert(s.doc, type, resolved) : null;
          // A stale target column falls through to a fresh section.
          newId =
            id ??
            opInsertInNewSection(s.doc, type, s.doc.sections.length).blockId;
          s.insertTarget = null;
          s.selection = newId;
          s.selectedSectionId = null;
          s.headerSelected = false;
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

      addHeader: () =>
        set((s) => {
          if (!s.doc.header) {
            pushHistory(s);
            opSetHeader(s.doc, emptyHeader(s.doc.meta.title));
          }
          s.headerSelected = true;
          s.selection = null;
          s.selectedSectionId = null;
        }),

      removeHeader: () =>
        set((s) => {
          if (!s.doc.header) {
            return;
          }
          pushHistory(s);
          opRemoveHeader(s.doc);
          s.headerSelected = false;
        }),

      setHeaderProp: (path, value) =>
        set((s) => {
          if (!s.doc.header) {
            return;
          }
          pushHistory(s);
          opSetHeaderProp(s.doc, path, value);
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

      bindCollection: (id, source) =>
        set((s) => {
          pushHistory(s);
          opBindCollection(s.doc, id, source);
        }),

      setTheme: (theme) =>
        set((s) => {
          pushHistory(s);
          opSetTheme(s.doc, theme);
          s.themePreview = null;
        }),

      setThemePreview: (theme) =>
        set((s) => {
          s.themePreview = theme;
        }),

      setMeta: (key, value) =>
        set((s) => {
          pushHistory(s);
          opSetMeta(s.doc, key, value);
        }),

      setStatus: (status) =>
        set((s) => {
          // Every undo and redo step too: restoring one must not bring back
          // the status the page had when the step was taken.
          for (const holder of metaHolders(s)) {
            holder.meta.status = status;
          }
        }),

      adoptStoredMeta: (sent, stored) =>
        set((s) => {
          for (const key of STORED_META_KEYS) {
            const from = sent[key];
            const to = stored[key];
            if (from === undefined || to === undefined || from === to) {
              continue;
            }
            for (const holder of metaHolders(s)) {
              if (holder.meta[key] === from) {
                holder.meta[key] = to;
              }
            }
          }
        }),

      dropPageTheme: (theme) =>
        set((s) => {
          if (!sameTheme(s.doc.meta.theme, theme)) {
            return;
          }
          // Absent, not undefined: absent is what "follows the department"
          // looks like everywhere a document is read.
          for (const holder of metaHolders(s)) {
            if (sameTheme(holder.meta.theme, theme)) {
              const { theme: _departmentHasIt, ...meta } = holder.meta;
              holder.meta = meta;
            }
          }
        }),

      setDoc: (doc) =>
        set((s) => {
          s.doc = structuredClone(doc);
          s.past = [];
          s.future = [];
          s.themePreview = null;
          reconcileSelection(s);
        }),

      select: (id) =>
        set((s) => {
          s.selection = id;
          s.selectedSectionId = null;
          s.headerSelected = false;
        }),
      selectSection: (id) =>
        set((s) => {
          s.selectedSectionId = id;
          s.selection = null;
          s.headerSelected = false;
        }),
      selectHeader: () =>
        set((s) => {
          s.headerSelected = s.doc.header !== undefined;
          s.selection = null;
          s.selectedSectionId = null;
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
          s.themePreview = null;
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
          s.themePreview = null;
          const entry = s.past.pop();
          if (!entry) {
            return;
          }
          s.future.push(snap(s.doc));
          restore(s.doc, entry);
          reconcileSelection(s);
        }),

      redo: () =>
        set((s) => {
          s.themePreview = null;
          const entry = s.future.pop();
          if (!entry) {
            return;
          }
          s.past.push(snap(s.doc));
          restore(s.doc, entry);
          reconcileSelection(s);
        }),
    };
  })
);
