import { createAdminClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import {
  getExpenseDetail,
  isNotFound,
} from "@/app/(portal)/expenses/expenses-data";
import { getExpenseViewer } from "@/lib/expense-viewer";

const EXPENSES_BUCKET = "expenses";
/** Types a browser may render in the page. Anything else is a download. */
const INLINE_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

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
    // A receipt is student-supplied, so never let the browser interpret an
    // unexpected type (an HTML or SVG file would run on the admin origin).
    const inline = INLINE_MIME_TYPES.has(file.mimeType?.toLowerCase() ?? "");
    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": inline ? "inline" : "attachment",
        "Content-Type": inline ? file.mimeType : "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
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
