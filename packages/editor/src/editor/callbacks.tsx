"use client";

import { createContext, useContext } from "react";
import type {
  EditorDepartment,
  EditorLocale,
  EditorLocaleOption,
  PageDoc,
} from "./types";

export interface EditorCallbacks {
  activeLocale: EditorLocale;
  departments: EditorDepartment[];
  locales: EditorLocaleOption[];
  /**
   * Meta fields the host has bound to something outside the editor and that
   * must not be edited here. Unit pages set slug + department: both encode the
   * page's binding to a department, and changing either orphans the page.
   */
  lockedMeta?: { department?: boolean; slug?: boolean };
  onExit?: () => void;
  onLocaleChange: (locale: EditorLocale) => void;
  onPublish?: (locale: EditorLocale) => Promise<void>;
  onTranslateLocale?: (targetLocale: EditorLocale) => Promise<void>;
  onUnpublish?: (locale: EditorLocale) => Promise<void>;
  savePage: (
    doc: PageDoc,
    locale: EditorLocale
  ) => Promise<{ slug?: string } | undefined>;
  translatingLocale?: EditorLocale | null;
  uploadFile: (fd: FormData) => Promise<{ fileId: string; url: string }>;
}

// Noop implementation for web renderer context (edit=false; callbacks are never invoked).
const NOOP_CALLBACKS: EditorCallbacks = {
  savePage: async () => undefined,
  uploadFile: async () => ({ fileId: "", url: "" }),
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
