"use client";

import { createContext, useContext } from "react";
import type {
  EditorCampus,
  EditorDepartment,
  EditorLocale,
  EditorLocaleOption,
  PageDoc,
  PublishOutcome,
  StoredMeta,
} from "./types";

export interface EditorCallbacks {
  activeLocale: EditorLocale;
  /** Campuses this editor may assign a page to, in display order. */
  campuses: EditorCampus[];
  departments: EditorDepartment[];
  locales: EditorLocaleOption[];
  /**
   * Meta fields the host has bound to something outside the editor and that
   * must not be edited here. Unit pages set slug + department: both encode the
   * page's binding to a department, and changing either orphans the page.
   */
  lockedMeta?: { campus?: boolean; department?: boolean; slug?: boolean };
  onExit?: () => void;
  onLocaleChange: (locale: EditorLocale) => void;
  onPublish?: (locale: EditorLocale) => Promise<PublishOutcome | undefined>;
  onTranslateLocale?: (targetLocale: EditorLocale) => Promise<void>;
  onUnpublish?: (locale: EditorLocale) => Promise<void>;
  savePage: (
    doc: PageDoc,
    locale: EditorLocale
  ) => Promise<StoredMeta | undefined>;
  translatingLocale?: EditorLocale | null;
  uploadFile: (fd: FormData) => Promise<{ fileId: string; url: string }>;
}

// Noop implementation for web renderer context (edit=false; callbacks are never invoked).
const NOOP_CALLBACKS: EditorCallbacks = {
  savePage: async () => undefined,
  uploadFile: async () => ({ fileId: "", url: "" }),
  campuses: [],
  departments: [],
  activeLocale: "no",
  locales: [{ locale: "no", label: "Norwegian", hasDraft: true }],
  onLocaleChange: () => undefined,
};

export const EditorCallbacksContext =
  createContext<EditorCallbacks>(NOOP_CALLBACKS);

export function useEditorCallbacks(): EditorCallbacks {
  return useContext(EditorCallbacksContext);
}

/**
 * Whether this render is inside the editor, in either mode. Only
 * `EditorShell` provides the callbacks; the public renderer sees the no-op
 * default.
 */
export function useInEditor(): boolean {
  return useContext(EditorCallbacksContext) !== NOOP_CALLBACKS;
}
