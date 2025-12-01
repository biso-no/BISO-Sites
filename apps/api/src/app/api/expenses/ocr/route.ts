import { openai } from "@ai-sdk/openai";
import { createSessionClient } from "@repo/api/server";
import { generateObject } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Response schema for AI extraction
const ExpenseDataSchema = z.object({
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
async function getHistoricalRate(
  date: string,
  currency: string
): Promise<number | null> {
  if (currency === "NOK") {
    return 1;
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
  preparedFile: Extract<FileValidationResult, { ok: true }>
): Promise<ExpenseData> {
  if (preparedFile.isPdf) {
    return extractExpenseDataFromPdf(preparedFile.buffer);
  }

  return extractExpenseDataFromImage(preparedFile.buffer);
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

/**
 * Use OpenAI Vision to extract structured expense data directly from image
 */
async function extractExpenseDataFromImage(
  imageBuffer: Buffer
): Promise<ExpenseData> {
  const { object } = await generateObject({
    model: openai("gpt-5-nano"),
    schema: ExpenseDataSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract expense information from this receipt/invoice image.
If a field cannot be determined, return null for that field.
For dates, convert to YYYY-MM-DD format.
For descriptions, summarize the main purchase(s) in one brief line.
For amounts, find the total/sum ("Totalt", "Sum", "Total", etc.).
For currency, default to NOK if it appears to be a Norwegian receipt.`,
          },
          {
            type: "image",
            image: imageBuffer,
          },
        ],
      },
    ],
  });

  return object;
}

/**
 * Extract text from PDF and use AI to parse it
 */
async function extractExpenseDataFromPdf(buffer: Buffer): Promise<ExpenseData> {
  const { object } = await generateObject({
    model: openai("gpt-5-nano"),
    schema: ExpenseDataSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract expense information from this receipt/invoice text.
If a field cannot be determined, return null for that field.
For dates, convert to YYYY-MM-DD format.
For descriptions, summarize the main purchase(s) in one brief line.
For amounts, find the total/sum.
For currency, default to NOK if it appears to be Norwegian.
`,
          },
          {
            type: "file",
            data: buffer,
            mediaType: "application/pdf",
          },
        ],
      },
    ],
  });

  return object;
}

export async function POST(req: NextRequest) {
  // Auth check
  const { account } = await createSessionClient();
  const user = await account.get();

  if (!user) {
    return buildErrorResponse("Unauthorized", 401);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    const preparedFile = await validateAndPrepareFile(file);

    if (!preparedFile.ok) {
      return preparedFile.response;
    }

    const expenseData = await parseExpenseData(preparedFile);
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
