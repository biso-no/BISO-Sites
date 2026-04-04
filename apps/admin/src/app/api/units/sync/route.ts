import { createAdminClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import { getDepartments } from "@repo/connectors/24sevenoffice";
import { type NextRequest, NextResponse } from "next/server";

function getCampusId(deptNum: number): string {
  if (deptNum >= 1 && deptNum <= 299) {
    return "1";
  }
  if (deptNum >= 300 && deptNum <= 599) {
    return "2";
  }
  if (deptNum >= 600 && deptNum <= 799) {
    return "3";
  }
  if (deptNum >= 800 && deptNum <= 999) {
    return "4";
  }
  return "5";
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
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
        campus_id: getCampusId(deptNum),
      };
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
