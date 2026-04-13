"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Documents } from "@repo/api/types/appwrite";

interface ListPublishedDocumentsParams {
  campusId?: string | null;
  category?: string;
}

export async function listPublishedDocuments(
  params: ListPublishedDocumentsParams = {}
): Promise<Documents[]> {
  const { campusId, category } = params;

  try {
    const { db } = await createSessionClient();

    // Query 1: national documents (always shown regardless of campus filter)
    const nationalQueries: string[] = [
      Query.equal("status", "published"),
      Query.equal("scope", "national"),
      Query.orderAsc("sort_order"),
      Query.orderDesc("$updatedAt"),
      Query.limit(100),
    ];

    if (category && category !== "all" && category !== "campus-bylaws") {
      nationalQueries.push(Query.equal("category", category));
    }

    // If filtering by a specific non-bylaw category, campus bylaws won't appear
    // If filtering by "campus-bylaws", only show campus docs (skip national query for that category)
    const isBylawsOnlyFilter = category === "campus-bylaws";
    const nationalResult = isBylawsOnlyFilter
      ? { rows: [] as Documents[] }
      : await db.listRows<Documents>("app", "documents", nationalQueries);

    // Query 2: campus-specific documents (only campus-bylaws category uses scope=campus)
    let campusDocs: Documents[] = [];
    const wantCampusDocs =
      !category || category === "all" || category === "campus-bylaws";

    if (wantCampusDocs) {
      const campusQueries: string[] = [
        Query.equal("status", "published"),
        Query.equal("scope", "campus"),
        Query.orderAsc("sort_order"),
        Query.orderDesc("$updatedAt"),
        Query.limit(100),
      ];

      // Filter by specific campus when one is selected
      if (campusId && campusId !== "all") {
        campusQueries.push(Query.equal("campus_id", campusId));
      }

      const campusResult = await db.listRows<Documents>(
        "app",
        "documents",
        campusQueries
      );
      campusDocs = campusResult.rows;
    }

    // Merge: national docs always first, then campus bylaws
    return [...nationalResult.rows, ...campusDocs];
  } catch {
    return [];
  }
}
