import { ID, Permission, Role } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient } from "@repo/api/server";
import { ALLOWED_RECEIPT_LABEL } from "@repo/shared/utils/expense-attachments";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import {
  MAX_RECEIPT_BYTES,
  receiptFileName,
  receiptViewUrl,
  sniffReceiptMimeType,
} from "@/lib/receipt-file";

export const runtime = "nodejs";

const EXPENSES_BUCKET_ID = "expenses";

/**
 * Stores one receipt for a reimbursement.
 *
 * The `expenses` bucket has no user create grant, so a client cannot upload
 * there directly — the web uploads through a server action with the admin
 * key, and this route does the same for the app. The file is readable by its
 * uploader only; reviewers and ledger posting read it with the admin key.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const json = (data: unknown, status = 200) =>
    applyCorsHeaders(NextResponse.json(data, { status }), origin);

  if (!(await isFeatureEnabled("expenses_module"))) {
    return json(
      { success: false, error: "Reimbursements are currently unavailable" },
      403
    );
  }

  let userId: string;
  try {
    const { account } = await createAuthenticatedClient(req);
    userId = (await account.get()).$id;
  } catch {
    return json({ success: false, error: "Authentication required" }, 401);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return json({ success: false, error: "No file provided" }, 400);
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return json({ success: false, error: "File size exceeds 10MB limit" }, 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffReceiptMimeType(bytes);
  if (!mimeType) {
    return json(
      {
        success: false,
        error: `Unsupported file type. Please upload a ${ALLOWED_RECEIPT_LABEL} file.`,
      },
      415
    );
  }

  try {
    const { storage } = await createAdminClient();
    const name = receiptFileName(file.name, mimeType);
    const created = await storage.createFile(
      EXPENSES_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(Buffer.from(bytes), name),
      [Permission.read(Role.user(userId))]
    );

    return json(
      {
        success: true,
        file: {
          fileId: created.$id,
          mimeType,
          name: created.name,
          size: created.sizeOriginal,
          viewUrl: receiptViewUrl(created.$id),
        },
      },
      201
    );
  } catch (error) {
    console.error("[expenses/attachments] Upload failed:", error);
    return json({ success: false, error: "Failed to upload receipt" }, 500);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
