import { MODEL_IDS } from "@repo/ai/models";
import { appwriteErrorStatus } from "@repo/api/errors";
import { createAdminClient } from "@repo/api/server";
import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { findPossibleDuplicate } from "@/lib/expense-duplicates";
import { selectExamples } from "@/lib/expense-examples";
import { loadActiveCostTypes } from "@/lib/expense-types";
import {
  amountReadInNok,
  CLASSIFY_TIMEOUT_MS,
  type Classification,
  classifyReceipt,
  convertAmountToNok,
  type ExtractedReceipt,
  extractReceipt,
  findScan,
  type ScanPurpose,
  type StoredScan,
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

type PreparedFile = Extract<FileValidationResult, { ok: true }>;

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

const SCAN_MODEL = `${MODEL_IDS.balanced}+${MODEL_IDS.fast}`;

interface UploadScan {
  possibleDuplicate: boolean;
  scan: StoredScan;
}

/** The admin database, or null: the scan then goes on without storing. */
async function adminDb(): Promise<AdminDb | null> {
  try {
    return (await createAdminClient()).db;
  } catch (error) {
    console.error("[expenses/ocr] Scan bookkeeping failed:", error);
    return null;
  }
}

/** The active types, or none when they can't be read. */
async function activeTypes(db: AdminDb | null): Promise<CostTypeOption[]> {
  if (!db) {
    return [];
  }
  try {
    return await loadActiveCostTypes(db);
  } catch (error) {
    console.error("[expenses/ocr] Could not load expense types:", error);
    return [];
  }
}

/**
 * The AI's type for a receipt, within `CLASSIFY_TIMEOUT_MS`. A classification
 * the limit stopped is null, so the stored scan counts as not classified and
 * the submission can still classify it.
 */
async function classifyIfReceipt(
  db: AdminDb,
  receipt: ExtractedReceipt,
  types: CostTypeOption[]
): Promise<Classification | null> {
  if (receipt.documentType !== "receipt" || types.length === 0) {
    return null;
  }
  try {
    const examples = await selectExamples(db, {
      types,
      vendor: receipt.vendor,
    });
    const abortSignal = AbortSignal.timeout(CLASSIFY_TIMEOUT_MS);
    const classification = await classifyReceipt({
      abortSignal,
      examples,
      receipt,
      types,
    });
    return abortSignal.aborted ? null : classification;
  } catch (error) {
    console.error("[expenses/ocr] Classification failed:", error);
    return null;
  }
}

async function lookupDuplicate(
  db: AdminDb,
  fileHash: string,
  scan: StoredScan
): Promise<boolean> {
  if (scan.receipt.documentType !== "receipt") {
    return false;
  }
  const duplicate = await findPossibleDuplicate(db, {
    amount: amountReadInNok(scan),
    date: scan.receipt.date,
    fileHash,
  });
  return duplicate !== null;
}

/** A receipt the AI already gave a type (or found none for), as stored. */
function isTypedReceipt(scan: StoredScan): boolean {
  return (
    scan.receipt.documentType === "receipt" && scan.classification !== null
  );
}

async function reuseScan(
  db: AdminDb,
  fileHash: string,
  scan: StoredScan
): Promise<UploadScan> {
  try {
    return {
      possibleDuplicate: await lookupDuplicate(db, fileHash, scan),
      scan,
    };
  } catch (error) {
    console.error("[expenses/ocr] Duplicate lookup failed:", error);
    return { possibleDuplicate: false, scan };
  }
}

/** Classifies and stores a new scan, and looks for a duplicate meanwhile. */
async function scanExtras(
  db: AdminDb,
  fileHash: string,
  scan: StoredScan,
  types: CostTypeOption[]
): Promise<UploadScan> {
  const classifyAndStore = async () => {
    const classification = await classifyIfReceipt(db, scan.receipt, types);
    await saveScan(db, fileHash, { ...scan, classification }, SCAN_MODEL);
    return classification;
  };
  // Independent steps: a throw in one must not discard the other's result.
  const [stored, duplicate] = await Promise.allSettled([
    classifyAndStore(),
    lookupDuplicate(db, fileHash, scan),
  ]);
  if (stored.status === "rejected") {
    console.error("[expenses/ocr] Scan bookkeeping failed:", stored.reason);
  }
  return {
    possibleDuplicate: duplicate.status === "fulfilled" && duplicate.value,
    scan: {
      ...scan,
      classification: stored.status === "fulfilled" ? stored.value : null,
    },
  };
}

/**
 * Reads an upload. Unless it is sent as a bank statement, a file whose stored
 * scan is a receipt the AI already classified is answered from that scan,
 * without the model; the duplicate lookup still runs. Anything else is read
 * again while the active types load, and the first scan stored for the file
 * stays.
 */
async function scanUpload(
  file: PreparedFile,
  purpose: ScanPurpose
): Promise<UploadScan> {
  const db = await adminDb();
  const fileHash = sha256Hex(file.buffer);
  if (db && purpose !== "bank-statement") {
    const stored = await findScan(db, fileHash);
    if (stored && isTypedReceipt(stored)) {
      return reuseScan(db, fileHash, stored);
    }
  }

  const [receipt, types] = await Promise.all([
    extractReceipt({ buffer: file.buffer, mimeType: file.mimeType, purpose }),
    purpose === "bank-statement" ? [] : activeTypes(db),
  ]);
  const converted = await convertAmountToNok(receipt);
  const scan: StoredScan = { ...converted, classification: null, receipt };
  if (!db) {
    return { possibleDuplicate: false, scan };
  }
  return scanExtras(db, fileHash, scan, types);
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

    const { possibleDuplicate, scan } = await scanUpload(preparedFile, purpose);
    const { amountInNok, classification, exchangeRate, receipt } = scan;

    return applyCorsHeaders(
      NextResponse.json({
        success: true,
        data: {
          ...receipt,
          amountInNok,
          exchangeRate,
          costType: classification?.costType ?? null,
          costTypeConfidence: classification?.confidence ?? 0,
          ocrAmount: amountReadInNok(scan),
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
