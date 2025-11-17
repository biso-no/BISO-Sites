import { createSessionClient } from "@repo/api/server";
import { buildAppwriteQuery } from "@repo/editor/lib/query-builder";
import type { QueryConfig } from "@repo/editor/types";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

type QueryRequest = {
  collection: string;
  query?: QueryConfig;
  fieldMapping?: Record<string, string>;
};

export async function POST(request: Request) {
  try {
    const body: QueryRequest = await request.json();
    const { collection, query, fieldMapping } = body;

    if (!collection) {
      return Response.json(
        { success: false, error: "Collection is required" },
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

    // Apply field mapping if provided
    let documents = response.rows;

    if (fieldMapping && Object.keys(fieldMapping).length > 0) {
      documents = documents.map((doc) => {
        const mapped: Record<string, any> = { $id: doc.$id };

        Object.entries(fieldMapping).forEach(([targetField, sourceField]) => {
          if (sourceField in doc) {
            mapped[targetField] = doc[sourceField];
          }
        });

        return mapped;
      });
    }

    return Response.json({
      success: true,
      data: {
        documents,
        total: response.total,
      },
    });
  } catch (error) {
    console.error("Failed to query documents:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to query documents",
      },
      { status: 500 }
    );
  }
}

