import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { Departments } from "@repo/api/types/appwrite";
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

    if (campusId) {
      queries.push(Query.equal("campus_id", campusId));
    }
    if (type) {
      queries.push(Query.equal("type", type));
    }

    const result = await db.listRows<Departments>(
      "app",
      "departments",
      queries
    );

    return NextResponse.json({
      departments: result.rows.map((d) => ({
        id: d.$id,
        internalId: d.Id,
        name: d.Name,
        campusId: d.campus_id,
        type: d.type,
        logo: d.logo,
      })),
      total: result.total,
    });
  } catch (error) {
    console.error("Departments API error:", error);
    return NextResponse.json({ departments: [], total: 0 }, { status: 500 });
  }
}
