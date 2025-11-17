import { createAdminClient } from "@repo/api/server";

const DATABASE_ID = 'app';

export async function GET(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    const { db } = await createAdminClient();
    const { collectionId } = params;

    const collection = await db.getTable(DATABASE_ID, collectionId);

    return Response.json({
      success: true,
      data: collection,
    });
  } catch (error) {
    console.error("Failed to fetch collection schema:", error);
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch collection schema",
      },
      { status: 500 }
    );
  }
}

