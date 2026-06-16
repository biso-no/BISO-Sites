import type { Models } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  getAllDepartmentsSoap,
  getDepartments,
} from "@repo/connectors/24sevenoffice";
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

    // REST returns only ACTIVE departments; SOAP GetDepartmentList returns ALL
    // (active or not). Upsert the SOAP superset, marking a department active
    // only when it is also present in the REST result.
    const [restDepartments, soapDepartments] = await Promise.all([
      getDepartments(),
      getAllDepartmentsSoap(),
    ]);
    const activeIds = new Set(restDepartments.map((d) => String(d.value)));

    const results = await Promise.allSettled(
      soapDepartments.map((department) => {
        const deptNum = Number(department.id);
        const row = {
          $id: department.id,
          Id: department.id,
          Name: department.name,
          active: activeIds.has(department.id),
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

    return NextResponse.json({
      success: failed === 0,
      succeeded,
      failed,
      total: soapDepartments.length,
      active: activeIds.size,
      inactive: soapDepartments.length - activeIds.size,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
