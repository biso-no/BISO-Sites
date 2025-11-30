import "server-only";

type ExtractedDocumentData = {
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
