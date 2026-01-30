import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Campus } from "@repo/api/types/appwrite";
import { type NextRequest, NextResponse } from "next/server";
import { canManageCampus, getAdminScope } from "@/lib/admin-auth";

/**
 * GET /api/admin/departments?campusId=...
 * List departments for a specific campus, with authorization scoping.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const campusId = searchParams.get("campusId");

    if (!campusId) {
      return NextResponse.json(
        { error: "campusId query parameter is required" },
        { status: 400 }
      );
    }

    const { db } = await createSessionClient();

    // Get the campus first to check authorization
    const campus = await db.getRow<Campus>("app", "campus", campusId, [
      Query.select([
        "$id",
        "name",
        "departments.$id",
        "departments.Name",
        "departments.Id",
        "departments.active",
      ]),
    ]);

    // Check if admin can manage this campus
    if (!(scope.canManageAnyCampus || canManageCampus(scope, campus.name))) {
      return NextResponse.json(
        { error: "Forbidden: You cannot manage this campus" },
        { status: 403 }
      );
    }

    // Get departments from the relationship
    const departments = campus.departments || [];

    // Filter to active departments and map response
    const mapped = departments
      .filter((dept) => dept.active !== false)
      .map((dept) => ({
        id: dept.$id,
        name: dept.Name,
        code: dept.Id, // The ERP department code
        campusId,
        // Generate security group name from department code
        securityGroupName: `SG-App-Department-${dept.Id}`,
      }));

    return NextResponse.json({ departments: mapped });
  } catch (error: any) {
    console.error("Error fetching departments:", error);

    if (error.code === 404) {
      return NextResponse.json({ error: "Campus not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch departments" },
      { status: 500 }
    );
  }
}
