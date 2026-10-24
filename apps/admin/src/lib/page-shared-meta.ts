// The page meta every locale shares. A plain module (no "use server", no
// client APIs): the editor client copies these fields between its in-memory
// locale documents, and the save action writes them into every other stored
// locale draft. One list, so the two can never disagree.
import type { PageMeta } from "@repo/editor/types";

export const SHARED_META_FIELDS = [
  "slug",
  "campus",
  "department",
  "status",
  "theme",
] as const satisfies readonly (keyof PageMeta)[];

export type SharedMetaField = (typeof SHARED_META_FIELDS)[number];

export type SharedMeta = Pick<PageMeta, SharedMetaField>;

/**
 * `meta`'s shared fields, every one present as a key. One the document does
 * not have comes back undefined, so spreading the result over another
 * document's meta removes it there (a theme that follows the department).
 */
export function pickSharedMeta(meta: SharedMeta): SharedMeta {
  return Object.fromEntries(
    SHARED_META_FIELDS.map((field) => [field, meta[field]])
  ) as SharedMeta;
}
