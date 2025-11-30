// Re-export server actions
export {
  createManagedPage,
  deletePage,
  ensureTranslation,
  getManagedPage,
  listManagedPages,
  publishPage,
  savePageDraft,
  saveTranslatedPage,
  updateManagedPage,
} from "./actions";

// Re-export types
export type {
  CreateManagedPageInput,
  EnsureTranslationInput,
  ManagedPageTranslationInput,
  PublishPageInput,
  SavePageDraftInput,
  SaveTranslatedPageInput,
  UpdateManagedPageInput,
} from "./types";
