"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type {
  Campus,
  CampusData,
  CampusMetadata,
} from "@repo/api/types/appwrite";

export async function getCampusMetadata(): Promise<
  Record<string, CampusMetadata>
> {
  try {
    const { db } = await createSessionClient();

    const result = await db.listRows<CampusMetadata>("app", "campus_metadata");

    const metadata: Record<string, CampusMetadata> = {};

    for (const doc of result.rows) {
      const campusMetadata = doc;
      // Index by both campus_id and campus_name for easy lookup
      metadata[campusMetadata.campus_id] = campusMetadata;
      metadata[campusMetadata.campus_name] = campusMetadata;
    }

    return metadata;
  } catch (error) {
    console.error("Failed to fetch campus metadata:", error);
    return {};
  }
}

async function _getCampusMetadataById(
  campusId: string
): Promise<CampusMetadata | null> {
  try {
    const { db } = await createSessionClient();

    const result = await db.listRows<CampusMetadata>("app", "campus_metadata", [
      Query.equal("campus_id", campusId),
    ]);

    if (result.rows.length > 0) {
      return result.rows[0] ?? null;
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch campus metadata by ID:", error);
    return null;
  }
}

async function _getCampusMetadataByName(
  campusName: string
): Promise<CampusMetadata | null> {
  try {
    const { db } = await createSessionClient();

    const result = await db.listRows<CampusMetadata>("app", "campus_metadata", [
      Query.equal("campus_name", campusName.toLowerCase()),
    ]);

    if (result.rows.length > 0) {
      return result.rows[0] ?? null;
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch campus metadata by name:", error);
    return null;
  }
}

export async function getCampuses({
  includeNational = true,
  selectedCampusId = "all",
  includeDepartments = false,
}: {
  includeNational?: boolean;
  selectedCampusId?: string;
  includeDepartments?: boolean;
} = {}) {
  const { db } = await createSessionClient();

  const query: string[] = [];

  // Filter by National if specified
  if (!includeNational) {
    query.push(Query.notEqual("name", "National"));
  }

  if (selectedCampusId && selectedCampusId !== "all") {
    query.push(Query.equal("$id", selectedCampusId));
  }

  if (includeDepartments) {
    query.push(
      Query.select([
        "departments.$id",
        "departments.Name",
        "departments.active",
      ])
    );
  }

  const campuses = await db.listRows<Campus>("app", "campus", query);

  return campuses.rows;
}

/**
 * Get a single campus with its departments
 */
async function getCampusWithDepartments(campusId: string) {
  try {
    const { db } = await createSessionClient();

    const campus = await db.getRow<Campus>("app", "campus", campusId, [
      Query.select([
        "$id",
        "name",
        "departments.$id",
        "departments.Name",
        "departments.active",
      ]),
    ]);

    return {
      success: true,
      campus,
    };
  } catch (error) {
    console.error("Error fetching campus with departments:", error);
    return {
      success: false,
      campus: null,
      error: error instanceof Error ? error.message : "Failed to fetch campus",
    };
  }
}

export async function getCampusData() {
  const { db } = await createSessionClient();
  const campuses = await db.listRows<CampusData>("app", "campus_data");

  return campuses.rows;
}

/**
 * Get the active campus from user preferences
 * Returns campus ID or null for "all campuses"
 */
export async function getActiveCampus(): Promise<string | null> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    const campusId = user.prefs?.campusId;
    // Return null for "all" or if not set
    return campusId === "all" || !campusId ? null : campusId;
  } catch (_error) {
    // Not logged in or error - return null (all campuses)
    return null;
  }
}

/**
 * Set the active campus in user preferences
 * Pass null or "all" for all campuses
 */
export async function setActiveCampus(campusId: string | null): Promise<void> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    if (!user) {
      return;
    }
    const prefs = user.prefs;
    // Store "all" string or the actual campus ID
    await account.updatePrefs({
      ...prefs,
      campusId: campusId === null ? "all" : campusId,
    });
  } catch (error) {
    console.error("Failed to set active campus:", error);
  }
}
