import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Campus } from "@repo/api/types/appwrite";
import { type NextRequest, NextResponse } from "next/server";
import { canManageCampus, getAdminScope } from "@/lib/admin-auth";

/**
 * GET /api/admin/campuses
 * List campuses accessible to the current admin based on their scope.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await createSessionClient();
    const response = await db.listRows<Campus>("app", "campus", [
      Query.limit(100),
    ]);

    let campuses = response.rows;

    // Filter by scope if not global admin
    if (!scope.canManageAnyCampus) {
      campuses = campuses.filter((campus) =>
        canManageCampus(scope, campus.name)
      );
    }

    // Map to consistent response format
    const mapped = campuses.map((campus) => ({
      id: campus.$id,
      name: campus.name,
      // Map campus name to M365 Office location (same name pattern)
      officeLocation: campus.name,
    }));

    return NextResponse.json({ campuses: mapped });
  } catch (error) {
    console.error("Error fetching campuses:", error);
    return NextResponse.json(
      { error: "Failed to fetch campuses" },
      { status: 500 }
    );
  }
}
