import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthenticatedClient } from "@/lib/auth";

// Response schema for AI extraction
const ExpenseDataSchema = z.object({
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
  vendor: z.string().nullable().describe("Name of the store or vendor"),
});
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

  if (!response.ok) return null;

  const data = await response.json();
  const series = data?.dataSets?.[0]?.series as
    | Record<string, { observations: Record<string, number[]> }>
    | undefined;
  if (!series) return null;

  const seriesKey = Object.keys(series)[0];
  if (!seriesKey) return null;

  const observations = series[seriesKey]?.observations;
  if (!observations) return null;

  // Take the observation with the highest index (most recent within the window)
  const obsKeys = Object.keys(observations).sort((a, b) => Number(b) - Number(a));
  if (obsKeys.length === 0) return null;

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
    if (nbRate) return nbRate;
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
type ExpenseData = z.infer<typeof ExpenseDataSchema>;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const buildErrorResponse = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

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
  purpose: Purpose
): Promise<ExpenseData> {
  if (preparedFile.isPdf) {
    return extractExpenseDataFromPdf(preparedFile.buffer, purpose);
  }

  return extractExpenseDataFromImage(preparedFile.buffer, purpose);
}

async function convertAmountToNok(expenseData: ExpenseData) {
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
For descriptions, summarize the main purchase(s) in one brief line.
For amounts, find the total/sum ("Totalt", "Sum", "Total", etc.).
For currency, default to NOK if it appears to be a Norwegian receipt.
Set documentType to "receipt".`;

// Used when the caller explicitly knows the file is a bank statement
const BANK_STATEMENT_PROMPT = `This is a bank statement. Extract the single debit/charge transaction amount.
If a field cannot be determined, return null for that field.
For dates, find the transaction date and convert to YYYY-MM-DD format.
For amounts, find the NOK debit charge amount (the money that was withdrawn).
Currency should almost always be NOK on a Norwegian bank statement.
For description, use the merchant/payee name from the transaction.
Ignore account totals, running balances, and unrelated transactions.
Set documentType to "bank-statement".`;

// Used when the document type is unknown — AI classifies freely
const AUTO_PROMPT = `Extract expense information from this document.
First determine the document type: set documentType to "bank-statement" if this is a bank account statement or transaction record, or "receipt" if it is a purchase receipt or invoice.
If a field cannot be determined, return null for that field.
For dates, convert to YYYY-MM-DD format.
For amounts: if a receipt, find the purchase total ("Totalt", "Sum", "Total", etc.); if a bank statement, find the debit/charge amount (money withdrawn).
For currency, default to NOK if it appears to be Norwegian.
For vendor, use the merchant or payee name.`;

type Purpose = "receipt" | "bank-statement" | "auto";

function purposeToPrompt(purpose: Purpose): string {
  if (purpose === "bank-statement") return BANK_STATEMENT_PROMPT;
  if (purpose === "receipt") return RECEIPT_PROMPT;
  return AUTO_PROMPT;
}

/**
 * Use OpenAI Vision to extract structured expense data directly from image
 */
async function extractExpenseDataFromImage(
  imageBuffer: Buffer,
  purpose: Purpose
): Promise<ExpenseData> {
  const { object } = await generateObject({
    model: openai("gpt-5-nano"),
    schema: ExpenseDataSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: purposeToPrompt(purpose) },
          { type: "image", image: imageBuffer },
        ],
      },
    ],
  });

  return object;
}

/**
 * Extract text from PDF and use AI to parse it
 */
async function extractExpenseDataFromPdf(
  buffer: Buffer,
  purpose: Purpose
): Promise<ExpenseData> {
  const { object } = await generateObject({
    model: openai("gpt-5-nano"),
    schema: ExpenseDataSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: purposeToPrompt(purpose) },
          { type: "file", data: buffer, mediaType: "application/pdf" },
        ],
      },
    ],
  });

  return object;
}

export async function POST(req: NextRequest) {
  // Auth check - supports both JWT (Authorization header) and session cookie
  const { account } = await createAuthenticatedClient(req);
  const user = await account.get();

  if (!user) {
    return buildErrorResponse("Unauthorized", 401);
  }

  try {
    const { searchParams } = new URL(req.url);
    const purposeParam = searchParams.get("purpose");
    const purpose: Purpose =
      purposeParam === "bank-statement"
        ? "bank-statement"
        : purposeParam === "receipt"
          ? "receipt"
          : "auto";

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    const preparedFile = await validateAndPrepareFile(file);

    if (!preparedFile.ok) {
      return preparedFile.response;
    }

    const expenseData = await parseExpenseData(preparedFile, purpose);
    const { amountInNok, exchangeRate } = await convertAmountToNok(expenseData);

    return NextResponse.json({
      success: true,
      data: {
        ...expenseData,
        amountInNok,
        exchangeRate,
      },
      method: preparedFile.isPdf ? "pdf" : "vision",
    });
  } catch (error) {
    console.error("OCR Processing Error:", error);
    return buildErrorResponse("Failed to process document", 500);
  }
}
