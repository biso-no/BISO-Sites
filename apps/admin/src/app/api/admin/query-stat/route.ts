import { createSessionClient } from "@repo/api/server";
import { buildAppwriteQuery } from "@repo/editor/lib/query-builder";
import type { QueryConfig } from "@repo/editor/types";

const DATABASE_ID = 'app';

type StatRequest = {
  collection: string;
  statType: "count" | "sum" | "average";
  valueField?: string;
  query?: QueryConfig;
};

export async function POST(request: Request) {
  try {
    const body: StatRequest = await request.json();
    const { collection, statType, valueField, query } = body;

    if (!collection || !statType) {
      return Response.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { db } = await createSessionClient();

    // Build query
    const queries = query ? buildAppwriteQuery(query) : [];

    // Fetch documents
    const response = await db.listRows(
      DATABASE_ID,
      collection,
      queries
    );

    let value: number;

    switch (statType) {
      case "count":
        value = response.total;
        break;

      case "sum":
        if (!valueField) {
          return Response.json(
            { success: false, error: "valueField required for sum" },
            { status: 400 }
          );
        }
        value = response.rows.reduce((sum, doc) => {
          const fieldValue = doc[valueField];
          return sum + (typeof fieldValue === "number" ? fieldValue : 0);
        }, 0);
        break;

      case "average":
        if (!valueField) {
          return Response.json(
            { success: false, error: "valueField required for average" },
            { status: 400 }
          );
        }
        const sum = response.rows.reduce((sum, doc) => {
          const fieldValue = doc[valueField];
          return sum + (typeof fieldValue === "number" ? fieldValue : 0);
        }, 0);
        value = response.rows.length > 0 ? sum / response.rows.length : 0;
        break;

      default:
        return Response.json(
          { success: false, error: "Invalid statType" },
          { status: 400 }
        );
    }

    return Response.json({
      success: true,
      data: {
        value,
        count: response.total,
      },
    });
  } catch (error) {
    console.error("Failed to compute stat:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to compute stat",
      },
      { status: 500 }
    );
  }
}

