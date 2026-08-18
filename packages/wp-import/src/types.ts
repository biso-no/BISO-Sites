export type ContentLocale = "no" | "en";

/** Appwrite campus.$id values, verified live 2026-08-18. */
export const CAMPUS_IDS: Record<string, string> = {
  Bergen: "2",
  National: "5",
  Oslo: "1",
  Stavanger: "4",
  Trondheim: "3",
};

export interface RejectRow {
  /** Human-readable identifier, e.g. the post title. */
  label: string;
  /** Why this row could not be imported. */
  reason: string;
  /** WordPress post id. */
  sourceId: number;
}

export interface ImportReport {
  imported: number;
  rejected: RejectRow[];
  warnings: string[];
}
