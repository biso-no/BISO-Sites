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

/**
 * Structural type for the `fetch` used by this package's clients.
 *
 * Deliberately NOT `typeof fetch`: Bun's global `fetch` type is merged with a
 * `fetch.preconnect` static, so a plain mock function can never satisfy it and
 * every test double would need an `as unknown as typeof fetch` double-cast.
 * A double-cast suppresses exactly the type errors test type-checking exists
 * to surface, so the seam is typed structurally instead.
 */
export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;
