import { MODEL_IDS } from "@repo/ai/models";
import { appwriteErrorStatus } from "@repo/api/errors";
import { createAdminClient } from "@repo/api/server";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { findPossibleDuplicate } from "@/lib/expense-duplicates";
import { selectExamples } from "@/lib/expense-examples";
import { loadActiveCostTypes } from "@/lib/expense-types";
import {
  type Classification,
  classifyReceipt,
  convertAmountToNok,
  type ExtractedReceipt,
  extractReceipt,
  type ScanPurpose,
  saveScan,
  sha256Hex,
} from "@/lib/receipt-scan";

export const maxDuration = 300; // 5 minutes for AI processing

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const HTTP_UNAUTHORIZED = 401;
const HTTP_INTERNAL_ERROR = 500;

const buildErrorResponse = (
  message: string,
  status = 400,
  origin: string | null = null
) =>
  applyCorsHeaders(NextResponse.json({ error: message }, { status }), origin);

type FileValidationResult =
  | {
      ok: true;
      buffer: Buffer;
      isPdf: boolean;
      mimeType: string;
    }
  | { ok: false; response: NextResponse };

async function validateAndPrepareFile(
  file: File | null
): Promise<FileValidationResult> {
  if (!file) {
    return { ok: false, response: buildErrorResponse("No file provided") };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      ok: false,
      response: buildErrorResponse(
        `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`
      ),
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      ok: false,
      response: buildErrorResponse("File size exceeds 10MB limit"),
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    ok: true,
    buffer,
    isPdf: file.type === "application/pdf",
    mimeType: file.type,
  };
}

function parseExpenseData(
  preparedFile: Extract<FileValidationResult, { ok: true }>,
  purpose: ScanPurpose
): Promise<ExtractedReceipt> {
  return extractReceipt({
    buffer: preparedFile.buffer,
    mimeType: preparedFile.mimeType,
    purpose,
  });
}

function purposeFromSearchParam(value: string | null): ScanPurpose {
  if (value === "bank-statement") {
    return "bank-statement";
  }
  if (value === "receipt") {
    return "receipt";
  }
  return "auto";
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function classifyIfReceipt(
  db: AdminDb,
  receipt: ExtractedReceipt
): Promise<Classification | null> {
  if (receipt.documentType !== "receipt") {
    return null;
  }
  try {
    const types = await loadActiveCostTypes(db);
    if (types.length === 0) {
      return null;
    }
    const examples = await selectExamples(db, {
      types,
      vendor: receipt.vendor,
    });
    return await classifyReceipt({ examples, receipt, types });
  } catch (error) {
    console.error("[expenses/ocr] Classification failed:", error);
    return null;
  }
}

async function scanExtras(
  buffer: Buffer,
  receipt: ExtractedReceipt,
  converted: { amountInNok: number | null; exchangeRate: number | null }
) {
  const ocrAmount = converted.amountInNok ?? receipt.amount;
  const fallback = {
    classification: null,
    possibleDuplicate: false,
  };
  try {
    const { db } = await createAdminClient();
    const fileHash = sha256Hex(buffer);
    const classification = await classifyIfReceipt(db, receipt);
    await saveScan(
      db,
      fileHash,
      { ...converted, classification, receipt },
      `${MODEL_IDS.balanced}+${MODEL_IDS.fast}`
    );
    const duplicate =
      receipt.documentType === "receipt"
        ? await findPossibleDuplicate(db, {
            amount: ocrAmount,
            date: receipt.date,
            fileHash,
          })
        : null;
    return { classification, possibleDuplicate: duplicate !== null };
  } catch (error) {
    console.error("[expenses/ocr] Scan bookkeeping failed:", error);
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  // Auth check - supports both JWT (Authorization header) and session cookie
  // account.get() throws (Appwrite 401) for a missing/expired session; keep it
  // inside a try so the caller gets a JSON 401 with CORS, not an unhandled 500.
  try {
    const { account } = await createAuthenticatedClient(req);
    await account.get();
  } catch (error) {
    if (appwriteErrorStatus(error) === HTTP_UNAUTHORIZED) {
      return buildErrorResponse("Unauthorized", HTTP_UNAUTHORIZED, origin);
    }
    console.error("[expenses/ocr] Auth check failed:", error);
    return buildErrorResponse(
      "Authentication check failed",
      HTTP_INTERNAL_ERROR,
      origin
    );
  }

  // Kill switch: AI receipt scanning is gated by the OCR flag and the parent
  // reimbursements module. Manual expense entry is unaffected.
  const flags = await getFeatureFlagStates();
  if (!(flags.expenses_module && flags.expenses_ocr)) {
    return buildErrorResponse(
      "Receipt scanning is currently disabled",
      403,
      origin
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const purposeParam = searchParams.get("purpose");
    const purpose = purposeFromSearchParam(purposeParam);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    const preparedFile = await validateAndPrepareFile(file);

    if (!preparedFile.ok) {
      return applyCorsHeaders(preparedFile.response, origin);
    }

    const expenseData = await parseExpenseData(preparedFile, purpose);
    const { amountInNok, exchangeRate } = await convertAmountToNok(expenseData);
    const { classification, possibleDuplicate } = await scanExtras(
      preparedFile.buffer,
      expenseData,
      { amountInNok, exchangeRate }
    );

    return applyCorsHeaders(
      NextResponse.json({
        success: true,
        data: {
          ...expenseData,
          amountInNok,
          exchangeRate,
          costType: classification?.costType ?? null,
          costTypeConfidence: classification?.confidence ?? 0,
          ocrAmount: amountInNok ?? expenseData.amount,
          possibleDuplicate,
        },
        method: preparedFile.isPdf ? "pdf" : "vision",
      }),
      origin
    );
  } catch (error) {
    console.error("OCR Processing Error:", error);
    return buildErrorResponse("Failed to process document", 500, origin);
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
