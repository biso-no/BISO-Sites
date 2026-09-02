import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";

/**
 * The units on one campus, read from `departments` directly.
 *
 * `getDepartments()` goes through `content_translations` with
 * `content_type = "department"`, and **that table holds zero department rows** —
 * so every consumer of it (the campus page's units grid, `/units`) renders an
 * empty list while 141 active departments sit in the table. The names,
 * abbreviations and slugs are on the department row itself and need no
 * translation, so this reads them there.
 *
 * `type`, `logo`, `hero` and `description` are null on all 280 rows, so nothing
 * here tries to render them.
 */
export interface CampusUnit {
  abbreviation: string | null;
  campusId: string;
  id: string;
  name: string;
  slug: string | null;
}

const UNIT_SELECT = [
  "$id",
  "Name",
  "slug",
  "abbreviation",
  "campus_id",
  "active",
] as const;

export function campusUnits(campusId: string): Promise<CampusUnit[]> {
  return activeUnits(campusId);
}

/** Every active unit, or those on one campus. Sorted by name, Norwegian collation. */
export async function activeUnits(
  campusId?: string | null
): Promise<CampusUnit[]> {
  try {
    const { db } = await createSessionClient();
    const queries = [
      Query.select([...UNIT_SELECT]),
      Query.equal("active", true),
      Query.limit(500),
    ];
    if (campusId) {
      queries.push(Query.equal("campus_id", campusId));
    }
    const response = await db.listRows<Departments>(
      "app",
      "departments",
      queries
    );
    return response.rows
      .map((row) => ({
        id: row.$id,
        name: row.Name,
        slug: row.slug,
        abbreviation: row.abbreviation,
        campusId: row.campus_id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "nb"));
  } catch (error) {
    console.error("Error fetching units:", error);
    return [];
  }
}
