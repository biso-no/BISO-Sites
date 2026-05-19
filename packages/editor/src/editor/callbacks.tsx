"use client";

import { createContext, useContext } from "react";
import type { EditorDepartment, PageDoc } from "./types";

export interface EditorCallbacks {
  savePage: (doc: PageDoc) => Promise<void>;
  uploadFile: (fd: FormData) => Promise<{ fileId: string; url: string }>;
  departments: EditorDepartment[];
}

// Noop implementation for web renderer context (edit=false; callbacks are never invoked).
const NOOP_CALLBACKS: EditorCallbacks = {
  savePage: async () => {},
  uploadFile: async () => ({ fileId: "", url: "" }),
  departments: [],
};

export const EditorCallbacksContext = createContext<EditorCallbacks>(NOOP_CALLBACKS);

export function useEditorCallbacks(): EditorCallbacks {
  return useContext(EditorCallbacksContext);
}
