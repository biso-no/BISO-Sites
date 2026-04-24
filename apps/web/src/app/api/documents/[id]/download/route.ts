import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Documents } from "@repo/api/types/appwrite";
import {
  SharePointService,
  getSharePointConfig,
} from "@repo/connectors/sharepoint";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { db } = await createSessionClient();
    const result = await db.listRows<Documents>("app", "documents", [
      Query.equal("$id", id),
      Query.equal("status", "published"),
      Query.limit(1),
    ]);

    const doc = result.rows[0];
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const sp = new SharePointService(getSharePointConfig());
    const buffer = await sp.downloadDocument(
      doc.sharepoint_drive_id,
      doc.sharepoint_item_id
    );

    const safeFileName = doc.title.replace(/[^a-z0-9\s-]/gi, "_").trim();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFileName}.pdf"`,
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
