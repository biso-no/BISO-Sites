import { createAdminClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import {
  getExpenseDetail,
  isNotFound,
} from "@/app/(portal)/expenses/expenses-data";
import { getExpenseViewer } from "@/lib/expense-viewer";

const EXPENSES_BUCKET = "expenses";

/**
 * Streams one receipt of an expense. Route handlers sit outside the portal
 * layout gate, so access is checked here: the viewer must be able to see the
 * expense and the file must be one of its receipts. Anything else is a 404, so
 * an outsider cannot tell whether a file exists.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ expenseId: string; fileId: string }> }
) {
  const { expenseId, fileId } = await context.params;
  const notFound = () =>
    NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const viewer = await getExpenseViewer();
    if (!viewer) {
      return notFound();
    }
    const detail = await getExpenseDetail(viewer, expenseId);
    if (!detail?.receipts.some((r) => r.fileId === fileId)) {
      return notFound();
    }

    const { storage } = await createAdminClient();
    const [file, bytes] = await Promise.all([
      storage.getFile(EXPENSES_BUCKET, fileId),
      storage.getFileView(EXPENSES_BUCKET, fileId),
    ]);
    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "Content-Type": file.mimeType || "application/octet-stream",
      },
      status: 200,
    });
  } catch (error) {
    if (isNotFound(error)) {
      // The row points at a file that is gone from storage.
      return notFound();
    }
    console.error("[expense-file] failed to serve receipt", error);
    return NextResponse.json(
      { error: "Failed to load receipt" },
      { status: 500 }
    );
  }
}
