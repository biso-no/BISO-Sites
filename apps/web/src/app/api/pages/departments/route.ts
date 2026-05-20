import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campusId = searchParams.get("campus_id");
  const type = searchParams.get("type");

  try {
    const { db } = await createAdminClient();

    const queries: string[] = [
      Query.equal("active", true),
      Query.orderAsc("Name"),
      Query.limit(100),
    ];

    if (campusId) queries.push(Query.equal("campus_id", campusId));
    if (type) queries.push(Query.equal("type", type));

    const result = await db.listRows("app", "departments", queries);

    return NextResponse.json({
      departments: result.rows.map((d) => ({
        id: d.$id,
        internalId: (d as Record<string, unknown>).Id,
        name: (d as Record<string, unknown>).Name,
        campusId: (d as Record<string, unknown>).campus_id,
        type: (d as Record<string, unknown>).type,
        logo: (d as Record<string, unknown>).logo,
      })),
      total: result.total,
    });
  } catch (error) {
    console.error("Departments API error:", error);
    return NextResponse.json({ departments: [], total: 0 }, { status: 500 });
  }
}
