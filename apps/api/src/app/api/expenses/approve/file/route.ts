// Token-gated file proxy so an approver (not logged into the web app) can view
// the receipts behind a reimbursement. Validates that the file belongs to the
// expense behind the token, then streams it from the secured `expenses` bucket.

import { createAdminClient } from "@repo/api/server";
import { type NextRequest, NextResponse } from "next/server";
import { approvalOwnsFile } from "@/lib/expense-approval";

const EXPENSES_BUCKET = "expenses";

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const token = params.get("token");
  const fileId = params.get("fileId");

  if (!(token && fileId)) {
    return new NextResponse("Missing token or fileId", { status: 400 });
  }

  if (!(await approvalOwnsFile(token, fileId))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { storage } = await createAdminClient();
  const meta = await storage.getFile(EXPENSES_BUCKET, fileId);
  const bytes = (await storage.getFileDownload(
    EXPENSES_BUCKET,
    fileId
  )) as ArrayBuffer;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": meta.mimeType || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
