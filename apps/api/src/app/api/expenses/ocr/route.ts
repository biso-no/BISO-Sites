import { openai } from "@ai-sdk/openai";
import { createSessionClient } from "@repo/api/server";
import { generateObject } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";


import { PDFParse } from 'pdf-parse';

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
async function getHistoricalRate(date: string, currency: string): Promise<number | null> {
  if (currency === 'NOK') { return 1; }
  
  try {
    const response = await fetch(
      `https://api.frankfurter.app/${date}?from=${currency}&to=NOK`
    );
    const data = await response.json();
    return data.rates?.NOK || null;
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
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

/**
 * Use OpenAI Vision to extract structured expense data directly from image
 */
async function extractExpenseDataFromImage(
  base64Image: string,
  mimeType: string
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
            image: `data:${mimeType};base64,${base64Image}`,
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
async function extractExpenseDataFromPdf(
  buffer: Buffer
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
          }
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    // Validate file
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Convert to buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPdf = file.type === "application/pdf";

    let expenseData: ExpenseData;

    if (isPdf) {
      // For PDFs, extract text and use text-based AI
      expenseData = await extractExpenseDataFromPdf(buffer);
    } else {
      // For images, use OpenAI Vision directly (much better than Tesseract)
      const base64Image = buffer.toString("base64");
      expenseData = await extractExpenseDataFromImage(base64Image, file.type);
    }

    // Currency conversion if needed
    let amountInNok: number | null = null;
    let exchangeRate: number | null = null;

    if (expenseData.currency && expenseData.currency !== 'NOK' && expenseData.date && expenseData.amount) {
      // Ensure date is valid YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(expenseData.date)) {
        exchangeRate = await getHistoricalRate(expenseData.date, expenseData.currency);
        if (exchangeRate) {
          amountInNok = Number((expenseData.amount * exchangeRate).toFixed(2));
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...expenseData,
        amountInNok,
        exchangeRate,
      },
      method: isPdf ? "pdf" : "vision",
    });
  } catch (error) {
    console.error("OCR Processing Error:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
