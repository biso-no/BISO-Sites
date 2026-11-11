import { createHash } from "node:crypto";
import { balancedModel, fastModel } from "@repo/ai/models";
import { ID, Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { ExpenseReceiptScans } from "@repo/api/types/appwrite";
import type { CostTypeOption } from "@repo/shared/utils/expense-cost-types";
import { RECEIPT_ISSUE_CODES } from "@repo/shared/utils/expense-hints";
import { generateObject } from "ai";
import { z } from "zod";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const ExpenseDataSchema = z.object({
  address: z
    .string()
    .nullable()
    .describe("Full street address or visible location text, if present"),
  category: z
    .enum([
      "meal",
      "travel",
      "accommodation",
      "supplies",
      "event-materials",
      "fee",
      "other",
    ])
    .nullable()
    .describe("Accounting-friendly expense category"),
  city: z.string().nullable().describe("City visible or strongly implied"),
  country: z
    .string()
    .nullable()
    .describe("Country visible or strongly implied"),
  documentType: z
    .enum(["receipt", "bank-statement"])
    .describe(
      "Type of document: 'receipt' for purchase receipts/invoices, 'bank-statement' for bank transaction records showing account debits/credits"
    ),
  description: z
    .string()
    .nullable()
    .describe("Brief description of what was purchased"),
  amount: z
    .number()
    .nullable()
    .describe("Total amount in the original currency"),
  currency: z
    .string()
    .nullable()
    .describe("Currency code (NOK, USD, EUR, etc.)"),
  date: z.string().nullable().describe("Date of purchase in YYYY-MM-DD format"),
  purchaseContext: z
    .string()
    .nullable()
    .describe(
      "Short accounting-friendly context such as 'Lunch receipt, Stockholm' or 'Office supplies'"
    ),
  vendor: z.string().nullable().describe("Name of the store or vendor"),
  receiptIssues: z
    .array(z.enum(RECEIPT_ISSUE_CODES))
    .describe(
      "Problems with the document that are clearly visible. Leave empty when the document is a proper receipt or a bank statement."
    ),
});
export type ExtractedReceipt = z.infer<typeof ExpenseDataSchema>;

async function getNorgesBankRate(
  date: string,
  currency: string
): Promise<number | null> {
  // Use a 7-day lookback window to handle weekends and Norwegian public holidays
  const lookback = new Date(date);
  lookback.setDate(lookback.getDate() - 7);
  const startPeriod = lookback.toISOString().split("T")[0];

  const response = await fetch(
    `https://data.norges-bank.no/api/data/EXR/B.${currency}.NOK.SP00.A?format=sdmx-json&startPeriod=${startPeriod}&endPeriod=${date}&locale=en`
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const series = data?.dataSets?.[0]?.series as
    | Record<string, { observations: Record<string, number[]> }>
    | undefined;
  if (!series) {
    return null;
  }

  const seriesKey = Object.keys(series)[0];
  if (!seriesKey) {
    return null;
  }

  const observations = series[seriesKey]?.observations;
  if (!observations) {
    return null;
  }

  // Take the observation with the highest index (most recent within the window)
  const obsKeys = Object.keys(observations).sort(
    (a, b) => Number(b) - Number(a)
  );
  if (obsKeys.length === 0) {
    return null;
  }

  const rate = observations[obsKeys[0]]?.[0];
  return typeof rate === "number" && rate > 0 ? rate : null;
}

async function getHistoricalRate(
  date: string,
  currency: string
): Promise<number | null> {
  if (currency === "NOK") {
    return 1;
  }

  try {
    // Norges Bank publishes direct NOK rates — more accurate than ECB cross-rates
    const nbRate = await getNorgesBankRate(date, currency);
    if (nbRate) {
      return nbRate;
    }
  } catch {
    // fall through to Frankfurter
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.app/${date}?from=${currency}&to=NOK`
    );
    const data = await response.json();
    return data.rates?.NOK || null;
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return null;
  }
}

export async function convertAmountToNok(
  expenseData: Pick<ExtractedReceipt, "amount" | "currency" | "date">
): Promise<{ amountInNok: number | null; exchangeRate: number | null }> {
  const currency =
    typeof expenseData.currency === "string" ? expenseData.currency : null;
  const date = typeof expenseData.date === "string" ? expenseData.date : null;
  const hasForeignCurrency = currency && currency !== "NOK";
  const hasValidDate = !!date && DATE_REGEX.test(date);
  const amount =
    typeof expenseData.amount === "number" ? expenseData.amount : null;
  const canConvert =
    hasForeignCurrency &&
    hasValidDate &&
    amount !== null &&
    Boolean(date && currency);

  if (!canConvert) {
    return { amountInNok: null, exchangeRate: null };
  }

  const exchangeRate = await getHistoricalRate(date, currency);

  if (!exchangeRate) {
    return { amountInNok: null, exchangeRate: null };
  }

  const amountInNok = Number((amount * exchangeRate).toFixed(2));
  return { amountInNok, exchangeRate };
}

// Used when the caller knows the file is a purchase receipt
const RECEIPT_PROMPT = `Extract expense information from this receipt/invoice.
If a field cannot be determined, return null for that field.
For dates, convert to YYYY-MM-DD format.
For descriptions, summarize the main purchase(s) in one brief accounting-friendly line.
For amounts, find the total/sum ("Totalt", "Sum", "Total", etc.).
For currency, default to NOK if it appears to be a Norwegian receipt.
For location fields, extract visible address, city, and country when present. Use explicit evidence only.
For category, choose one of: meal, travel, accommodation, supplies, event-materials, fee, other.
For purchaseContext, prefer purpose-like text over vendor names. Examples: "Lunch receipt, Stockholm", "Train ticket", "Event supplies".
Set documentType to "receipt".
For receiptIssues, list only problems that are clearly visible (${RECEIPT_ISSUE_CODES.join(", ")}); leave it empty for a proper receipt.`;

// Used when the caller explicitly knows the file is a bank statement
const BANK_STATEMENT_PROMPT = `This is a bank statement. Extract the single debit/charge transaction amount.
If a field cannot be determined, return null for that field.
For dates, find the transaction date and convert to YYYY-MM-DD format.
For amounts, find the NOK debit charge amount (the money that was withdrawn).
Currency should almost always be NOK on a Norwegian bank statement.
For description, use the merchant/payee name from the transaction.
For location fields, extract visible city/country only when present.
For category, use the most likely category if obvious, otherwise other.
For purchaseContext, summarize the transaction purpose if clear, otherwise use the merchant/payee name.
Ignore account totals, running balances, and unrelated transactions.
Set documentType to "bank-statement".
For receiptIssues, return an empty list unless the document is clearly unreadable.`;

// Used when the document type is unknown — AI classifies freely
const AUTO_PROMPT = `Extract expense information from this document.
First determine the document type: set documentType to "bank-statement" if this is a bank account statement or transaction record, or "receipt" if it is a purchase receipt or invoice.
If a field cannot be determined, return null for that field.
For dates, convert to YYYY-MM-DD format.
For amounts: if a receipt, find the purchase total ("Totalt", "Sum", "Total", etc.); if a bank statement, find the debit/charge amount (money withdrawn).
For currency, default to NOK if it appears to be Norwegian.
For vendor, use the merchant or payee name.
For location fields, extract visible address, city, and country when present. Use explicit evidence only.
For category, choose one of: meal, travel, accommodation, supplies, event-materials, fee, other.
For purchaseContext, prefer purpose-like text over vendor names. Examples: "Lunch receipt, Stockholm", "Train ticket", "Event supplies".
For receiptIssues, list only problems that are clearly visible; leave it empty for a proper receipt or a bank statement.`;

export type ScanPurpose = "receipt" | "bank-statement" | "auto";

function purposeToPrompt(purpose: ScanPurpose): string {
  if (purpose === "bank-statement") {
    return BANK_STATEMENT_PROMPT;
  }
  if (purpose === "receipt") {
    return RECEIPT_PROMPT;
  }
  return AUTO_PROMPT;
}

export async function extractReceipt(input: {
  buffer: Buffer;
  mimeType: string;
  purpose: ScanPurpose;
}): Promise<ExtractedReceipt> {
  const { object } = await generateObject({
    model: balancedModel,
    schema: ExpenseDataSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: purposeToPrompt(input.purpose) },
          { type: "file", data: input.buffer, mediaType: input.mimeType },
        ],
      },
    ],
  });
  return object;
}

export interface TypeExample {
  description: string;
  finalType: string;
  source: "student" | "approver" | "admin";
  vendorKey: string;
}

export interface Classification {
  confidence: number;
  costType: string | null;
  reason: string | null;
}

const MAX_EXAMPLES = 10;
const MAX_PROMPT_VALUE = 200;
const WHITESPACE_RUN = /\s+/g;

// Receipt and example text is untrusted: keep it on one line and short so it
// cannot add fake type lines to the prompt.
function clean(value: string | number): string {
  return String(value).replace(WHITESPACE_RUN, " ").slice(0, MAX_PROMPT_VALUE);
}
const CONFIDENCE_CAP_NOTE = 0.8;

interface ClassifyInput {
  examples: TypeExample[];
  receipt: ExtractedReceipt;
  types: CostTypeOption[];
}

export function buildClassificationPrompt({
  receipt,
  types,
  examples,
}: ClassifyInput): string {
  const typeLines = types.map(
    (type) =>
      `${type.slug} — ${type.label}${type.description ? `: ${type.description}` : ""}`
  );
  const exampleLines = examples
    .slice(0, MAX_EXAMPLES)
    .map(
      (example) =>
        `"${[example.vendorKey, example.description].filter(Boolean).map(clean).join(" / ")}" → ${example.finalType} (${example.source})`
    );
  const show = (value: string | number | null) =>
    value === null || value === "" ? "unknown" : clean(value);
  return [
    "Pick the expense type that best fits this receipt.",
    "",
    "Expense types:",
    ...typeLines,
    ...(exampleLines.length > 0
      ? ["", "Past receipts like these were booked as:", ...exampleLines]
      : []),
    "",
    "Receipt:",
    `Vendor: ${show(receipt.vendor)}`,
    `Description: ${show(receipt.description)}`,
    `Purchase context: ${show(receipt.purchaseContext)}`,
    `Amount: ${show(receipt.amount)}`,
    `Currency: ${show(receipt.currency)}`,
    `City: ${show(receipt.city)}`,
    `Country: ${show(receipt.country)}`,
    "",
    "Answer with exactly one slug from the list, a confidence between 0 and 1 " +
      `(below ${CONFIDENCE_CAP_NOTE} when two types fit or the purpose is unclear), and a one-sentence reason.`,
  ].join("\n");
}

const ClassificationSchema = z.object({
  confidence: z.number(),
  costType: z.string(),
  reason: z.string(),
});

export async function classifyReceipt(
  input: ClassifyInput
): Promise<Classification> {
  if (input.types.length === 0) {
    return { confidence: 0, costType: null, reason: null };
  }
  const { object } = await generateObject({
    model: fastModel,
    prompt: buildClassificationPrompt(input),
    reasoning: "low",
    schema: ClassificationSchema,
  });
  if (!input.types.some((type) => type.slug === object.costType)) {
    return { confidence: 0, costType: null, reason: object.reason };
  }
  const confidence = Number.isFinite(object.confidence)
    ? Math.min(1, Math.max(0, object.confidence))
    : 0;
  return { confidence, costType: object.costType, reason: object.reason };
}

export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface StoredScan {
  amountInNok: number | null;
  classification: Classification | null;
  exchangeRate: number | null;
  receipt: ExtractedReceipt;
}

export async function findScan(
  db: Db,
  fileHash: string
): Promise<StoredScan | null> {
  try {
    const { rows } = await db.listRows<ExpenseReceiptScans>(
      "app",
      "expense_receipt_scans",
      [Query.equal("file_hash", fileHash), Query.limit(1)]
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    const parsed = JSON.parse(row.result) as Partial<StoredScan> | null;
    const receipt = parsed?.receipt;
    if (
      typeof receipt !== "object" ||
      receipt === null ||
      !Array.isArray(receipt.receiptIssues)
    ) {
      return null;
    }
    return parsed as StoredScan;
  } catch {
    return null;
  }
}

const MAX_RESULT_CHARS = 8000;
const TRUNCATE_STEPS = [2000, 500, 100, 0];

function fitScan(scan: StoredScan): string {
  let current = scan;
  let json = JSON.stringify(current);
  if (json.length <= MAX_RESULT_CHARS) {
    return json;
  }
  current = { ...current, receipt: { ...current.receipt, address: null } };
  for (const limit of TRUNCATE_STEPS) {
    const cut = (value: string | null) => value?.slice(0, limit) ?? null;
    current = {
      ...current,
      classification: current.classification && {
        ...current.classification,
        reason: cut(current.classification.reason),
      },
      receipt: {
        ...current.receipt,
        description: cut(current.receipt.description),
        purchaseContext: cut(current.receipt.purchaseContext),
      },
    };
    json = JSON.stringify(current);
    if (json.length <= MAX_RESULT_CHARS) {
      return json;
    }
  }
  return json;
}

function isConflict(error: unknown): boolean {
  const e = error as { code?: unknown; type?: unknown } | null;
  return e?.code === 409 || e?.type === "row_already_exists";
}

export async function saveScan(
  db: Db,
  fileHash: string,
  scan: StoredScan,
  model: string
): Promise<void> {
  try {
    await db.createRow("app", "expense_receipt_scans", ID.unique(), {
      file_hash: fileHash,
      model,
      result: fitScan(scan),
    });
  } catch (error) {
    if (!isConflict(error)) {
      console.error("[receipt-scan] Failed to store scan:", error);
    }
  }
}
