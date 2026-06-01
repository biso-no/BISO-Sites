import type { Models } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { getDepartments } from "@repo/connectors/24sevenoffice";
import { type NextRequest, NextResponse } from "next/server";
import { requireApiGlobalAdmin } from "@/lib/api-auth";

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

// POST (not GET) because this upserts department rows — a mutation must not
// be triggerable by prefetch/crawlers. Any external trigger must use POST.
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const auth = await requireApiGlobalAdmin();
  if (auth.response) {
    return auth.response;
  }

  try {
    const { db } = await createAdminClient();

    const departments = await getDepartments();

    const results = await Promise.allSettled(
      departments.map((department) => {
        const deptNum = Number(department.value);
        const row = {
          $id: department.value,
          Id: department.value,
          Name: department.name,
          active: true,
          campus_id: getCampusId(deptNum),
          campus: getCampusId(deptNum),
        };
        return db.upsertRow<Models.DefaultRow>(
          "app",
          "departments",
          row.$id,
          row
        );
      })
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;

    return NextResponse.json({ success: failed === 0, succeeded, failed });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
