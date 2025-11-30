import "server-only";

export type ExtractedDocumentData = {
  date: string | null;
  amount: number | null;
  description: string | null;
  confidence: number;
  method: "pdf" | "ocr" | "manual";
  currency?: string | null;
  exchangeRate?: number | null;
};

const DATE_PATTERNS: readonly RegExp[] = [
  /\b\d{2}[-./]\d{2}[-./]\d{4}\b/, // DD/MM/YYYY
  /\b\d{4}[-./]\d{2}[-./]\d{2}\b/, // YYYY/MM/DD
  /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i,
  /\b\d{1,2}\s+(?:januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember)\s+\d{4}\b/i,
];

const AMOUNT_PATTERNS: readonly RegExp[] = [
  /(?:NOK|kr\.?|KR)\s*(\d+(?:[.,]\d{2})?)/i,
  /(\d+(?:[.,]\d{2})?)\s*(?:NOK|kr\.?|KR)/i,
  /(?:total|sum|beløp|amount)[:\s]*(\d+(?:[.,]\d{2})?)/i,
  /(\d+(?:[.,]\d{2})?)/,
];

const DESCRIPTION_HEADER_REGEX =
  /(?:invoice|receipt|kvittering|faktura).*?\n/gi;
const DESCRIPTION_TOTAL_REGEX = /\b(?:total|sum|amount|beløp|mva|vat).*?\n/gi;
const AMOUNT_LINE_REGEX = /^\d+[.,]\d{2}$/;
const DATE_LINE_REGEX = /^\d{2}[-./]\d{2}[-./]\d{4}$/;

// Helper function to extract dates using various formats
function extractDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const timestamp = Date.parse(match[0]);
    if (Number.isNaN(timestamp)) {
      continue;
    }

    const serialized = new Date(timestamp).toISOString().split("T")[0];
    if (serialized) {
      return serialized;
    }
  }
  return null;
}

// Helper function to extract amounts
function extractAmount(text: string): number | null {
  // Look for currency amounts with various formats
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amount = Number.parseFloat(match[1]?.replace(",", ".") || "0");
      if (!Number.isNaN(amount)) {
        return amount;
      }
    }
  }
  return null;
}

// Helper function to extract description
function extractDescription(text: string): string | null {
  // Remove common headers and footers
  const cleanText = text
    .replace(DESCRIPTION_HEADER_REGEX, "")
    .replace(DESCRIPTION_TOTAL_REGEX, "")
    .trim();

  // Get the first non-empty line that's not a date or amount
  const lines = cleanText.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (
      trimmedLine &&
      !trimmedLine.match(AMOUNT_LINE_REGEX) && // not just an amount
      !trimmedLine.match(DATE_LINE_REGEX) // not just a date
    ) {
      return trimmedLine;
    }
  }
  return null;
}

// Process document using Scribe.js OCR
async function processWithScribe(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedDocumentData> {
  const scribe = await import("scribe.js-ocr");

  try {
    // Initialize scribe with both PDF and OCR support
    await scribe.default.init({ pdf: true, ocr: true });

    // Determine file type and prepare input
    const isPdf = mimeType === "application/pdf";
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );

    // Import files based on type
    if (isPdf) {
      await scribe.default.importFiles({ pdfFiles: [arrayBuffer] });
    } else {
      await scribe.default.importFiles({ imageFiles: [arrayBuffer] });
    }

    // Run OCR recognition with Norwegian and English
    await scribe.default.recognize({
      langs: ["eng", "nor"],
      mode: "quality",
    });

    // Export the text result
    const text = await scribe.default.exportData("txt");

    // Clean up
    await scribe.default.terminate();

    // Parse the extracted text
    const extractedText = typeof text === "string" ? text : "";
    const date = extractDate(extractedText);
    const amount = extractAmount(extractedText);
    const description = extractDescription(extractedText);

    // Calculate confidence based on what we extracted
    let confidence = 0;
    if (date) {
      confidence += 0.3;
    }
    if (amount) {
      confidence += 0.4;
    }
    if (description) {
      confidence += 0.3;
    }

    return {
      date,
      amount,
      description,
      confidence,
      method: isPdf ? "pdf" : "ocr",
      currency: null,
      exchangeRate: null,
    };
  } catch (error) {
    console.error("Scribe.js processing failed:", error);
    // Try to terminate on error
    try {
      await scribe.default.terminate();
    } catch {
      // Ignore termination errors
    }
    throw error;
  }
}

export async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedDocumentData> {
  const supportedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
  ];

  if (
    !supportedTypes.some(
      (t) => mimeType.startsWith(t.split("/")[0] || "") || mimeType === t
    )
  ) {
    console.error("Unsupported file type:", mimeType);
    return {
      date: null,
      amount: null,
      description: null,
      confidence: 0,
      method: "manual",
      currency: null,
      exchangeRate: null,
    };
  }

  try {
    return await processWithScribe(buffer, mimeType);
  } catch (error) {
    console.error("Document processing failed:", error);
    // Return a structure for manual input
    return {
      date: null,
      amount: null,
      description: null,
      confidence: 0,
      method: "manual",
      currency: null,
      exchangeRate: null,
    };
  }
}
