import type { Documents, DocumentVersions } from "@repo/api/types/appwrite";
import {
  compareDocumentVersions,
  formatDocumentVersion,
  parseDocumentVersion,
} from "@repo/shared/utils/document-version";
import { campusScopeIds } from "./campus-scope";

/**
 * Pure helpers for the public documents page (no directives, no I/O) so the
 * server action and client components can both import them.
 */

export interface PublicDocumentVersion {
  createdAt: string;
  fileSize: number | null;
  id: string;
  label: string;
}

export type PublicDocument = Documents & {
  previousVersions: PublicDocumentVersion[];
};

const CATEGORY_ORDER = [
  "national-statutes",
  "campus-bylaws",
  "code-of-conduct",
  "business-regulations",
  "communication-guidelines",
];

/**
 * National documents concern every campus, so they ride along with whichever
 * campus is selected; campus documents show only for their own campus. With
 * no campus selected, everything shows.
 */
export function isDocumentVisibleForCampus(
  doc: Pick<Documents, "campus_id" | "scope">,
  campusId: string | null | undefined
): boolean {
  const scopeIds = campusScopeIds(campusId);
  if (scopeIds === null || doc.scope === "national") {
    return true;
  }
  return doc.campus_id !== null && scopeIds.includes(doc.campus_id);
}

function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

export function sortDocumentsForDisplay<
  T extends Pick<Documents, "category" | "title">,
>(docs: T[]): T[] {
  return [...docs].sort(
    (a, b) =>
      categoryRank(a.category) - categoryRank(b.category) ||
      a.title.localeCompare(b.title, "nb")
  );
}

/** Adds each document's earlier versions, newest first, excluding the current one. */
export function attachPreviousVersions(
  docs: Documents[],
  versions: DocumentVersions[]
): PublicDocument[] {
  const byDocument = new Map<string, DocumentVersions[]>();
  for (const row of versions) {
    const rows = byDocument.get(row.document_id) ?? [];
    rows.push(row);
    byDocument.set(row.document_id, rows);
  }

  return docs.map((doc) => {
    const current = parseDocumentVersion(doc.version);
    const previousVersions = (byDocument.get(doc.$id) ?? [])
      .map((row) => ({
        row,
        version: { major: row.version_major, minor: row.version_minor },
      }))
      .filter(
        ({ version }) =>
          !current || compareDocumentVersions(version, current) !== 0
      )
      .sort((a, b) => compareDocumentVersions(b.version, a.version))
      .map(({ row, version }) => ({
        createdAt: row.$createdAt,
        fileSize: row.file_size,
        id: row.$id,
        label: formatDocumentVersion(version),
      }));
    return { ...doc, previousVersions };
  });
}
