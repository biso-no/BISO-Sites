import { getDepartments } from "@repo/connectors/24sevenoffice";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import { NextRequest, NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth-utils";
import { Departments } from "@repo/api/types/appwrite";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { db } = await createAdminClient();

    const departments = await getDepartments();

    const rows = departments.map((department) => {
      const deptNum = Number(department.value);
      const row = {
        $id: department.value,
        Id: department.value,
        Name: department.name,
        active: true,
        campus_id:
          deptNum >= 1 && deptNum <= 299
            ? "1"
            : deptNum >= 300 && deptNum <= 599
              ? "2"
              : deptNum >= 600 && deptNum <= 799
                ? "3"
                : deptNum >= 800 && deptNum <= 999
                  ? "4"
                  : "5",
      };
      console.log("Syncing department:", row);
      return db.upsertRow<Departments>("app", "departments", row.$id, row);
    });

    return NextResponse.json({ success: true, sync: rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
