import { createAdminClient } from "@repo/api/server";

const DATABASE_ID = 'app';

export async function GET() {
  try {
    const { db } = await createAdminClient();
    
    const response = await db.listTables(DATABASE_ID);
    
    return Response.json({
      success: true,
      data: response.tables,
    });
  } catch (error) {
    console.error("Failed to list collections:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to list tables",
      },
      { status: 500 }
    );
  }
}

