"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Documents, DocumentVersions } from "@repo/api/types/appwrite";
import {
  attachPreviousVersions,
  isDocumentVisibleForCampus,
  type PublicDocument,
  sortDocumentsForDisplay,
} from "@/lib/documents";

// Governing documents number in the tens; these caps are only a backstop.
const MAX_DOCUMENTS = 500;
const MAX_VERSIONS = 2000;

interface ListPublishedDocumentsParams {
  campusId?: string | null;
}

export async function listPublishedDocuments(
  params: ListPublishedDocumentsParams = {}
): Promise<PublicDocument[]> {
  try {
    const { db } = await createSessionClient();

    const published = await db.listRows<Documents>("app", "documents", [
      Query.equal("status", "published"),
      Query.limit(MAX_DOCUMENTS),
    ]);
    const visible = sortDocumentsForDisplay(
      published.rows.filter((doc) =>
        isDocumentVisibleForCampus(doc, params.campusId)
      )
    );
    if (visible.length === 0) {
      return [];
    }

    // History is an enhancement: if it cannot be read, still list documents.
    let versions: DocumentVersions[] = [];
    try {
      const result = await db.listRows<DocumentVersions>(
        "app",
        "document_versions",
        [
          Query.equal(
            "document_id",
            visible.map((doc) => doc.$id)
          ),
          Query.limit(MAX_VERSIONS),
        ]
      );
      versions = result.rows;
    } catch {
      versions = [];
    }

    return attachPreviousVersions(visible, versions);
  } catch {
    return [];
  }
}
