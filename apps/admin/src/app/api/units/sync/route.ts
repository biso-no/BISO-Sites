import type { Models } from "@repo/api";
import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
import {
  getAllDepartmentsSoap,
  getDepartments,
} from "@repo/connectors/24sevenoffice";
import { type NextRequest, NextResponse } from "next/server";
import { requireApiGlobalAdmin } from "@/lib/api-auth";
import { assignUnitSlugs } from "@/lib/departments";

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

    // Slugs are assigned once and never rewritten, so a 24SO rename cannot
    // change a live /units URL. Read the current state first: which rows are
    // already slugged, and which slugs are taken per campus.
    const existing = await db.listRows<Departments>("app", "departments", [
      Query.select(["$id", "campus_id", "slug"]),
      Query.limit(5000),
    ]);
    // A truncated read would make every unseen row look unslugged: already
    // assigned slugs would be rewritten and duplicates minted. Fail closed.
    if (existing.total > existing.rows.length) {
      throw new Error(
        `Department slug pre-read truncated (${existing.rows.length} of ${existing.total}); refusing to assign slugs`
      );
    }
    const newSlugs = assignUnitSlugs(
      existing.rows.map((row) => ({
        $id: row.$id,
        campus_id: row.campus_id,
        slug: row.slug,
      })),
      soapDepartments.map((department) => ({
        $id: department.id,
        active: activeIds.has(department.id),
        campusId: getCampusId(Number(department.id)),
        name: department.name,
      }))
    );

    const results = await Promise.allSettled(
      soapDepartments.map((department) => {
        const deptNum = Number(department.id);
        const assignedSlug = newSlugs.get(department.id);
        const row = {
          $id: department.id,
          Id: department.id,
          Name: department.name,
          active: activeIds.has(department.id),
          campus_id: getCampusId(deptNum),
          campus: getCampusId(deptNum),
          // Spread `{}`, never `{ slug: null }`, when there's nothing new to
          // set. Omitting the key vs. sending `slug: undefined` makes no
          // difference on the wire — node-appwrite serializes with
          // JSONbig.stringify, which drops undefined-valued keys either way.
          // The real hazard is `null`: upsertRow patches named columns, so an
          // explicit `null` WOULD write through and wipe an assigned slug.
          ...(assignedSlug ? { slug: assignedSlug } : {}),
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
      slugsAssigned: newSlugs.size,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
