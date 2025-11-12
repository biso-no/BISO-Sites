import 'server-only';
import { extractTextFromPdf } from '@/lib/pdf-text-extractor';

export interface ExtractedDocumentData {
  date: string | null;
  amount: number | null;
  description: string | null;
  confidence: number;
  method: 'pdf' | 'ocr' | 'manual';
  currency?: string | null;
  exchangeRate?: number | null;
}

// Helper function to extract dates using various formats
function extractDate(text: string): string | null {
  const datePatterns = [
    /\b\d{2}[-.\/]\d{2}[-.\/]\d{4}\b/, // DD/MM/YYYY
    /\b\d{4}[-.\/]\d{2}[-.\/]\d{2}\b/, // YYYY/MM/DD
    /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const date = new Date(match[0]);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        continue;
      }
    }
  }
  return null;
}

// Helper function to extract amounts
function extractAmount(text: string): number | null {
  // Look for currency amounts with various formats
  const amountPatterns = [
    /(?:NOK|kr\.?|KR)\s*(\d+(?:[.,]\d{2})?)/i,
    /(\d+(?:[.,]\d{2})?)\s*(?:NOK|kr\.?|KR)/i,
    /(\d+(?:[.,]\d{2})?)/
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(amount)) {
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
    .replace(/(?:invoice|receipt|kvittering).*?\n/gi, '')
    .replace(/\b(?:total|sum|amount|beløp).*?\n/gi, '')
    .trim();

  // Get the first non-empty line that's not a date or amount
  const lines = cleanText.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (
      trimmedLine &&
      !trimmedLine.match(/^\d+[.,]\d{2}$/) && // not just an amount
      !trimmedLine.match(/^\d{2}[-.\/]\d{2}[-.\/]\d{4}$/) // not just a date
    ) {
      return trimmedLine;
    }
  }
  return null;
}

// Process PDF files
async function processPDF(buffer: Buffer): Promise<ExtractedDocumentData> {
  try {
    const text = await extractTextFromPdf(buffer);

    const date = extractDate(text);
    const amount = extractAmount(text);
    const description = extractDescription(text);

    // Calculate confidence based on extracted data
    let confidence = 0;
    if (date) confidence += 0.3;
    if (amount) confidence += 0.4;
    if (description) confidence += 0.3;

    return {
      date,
      amount,
      description,
      confidence,
      method: 'pdf',
      currency: null,
      exchangeRate: null,
    };
  } catch (error) {
    console.error('PDF processing failed:', error);
    throw error;
  }
}




async function processImage(buffer: Buffer): Promise<ExtractedDocumentData> {
  try {
    const [{ createWorker }, { Jimp }] = await Promise.all([
      import('tesseract.js'),
      import('jimp'),
    ]);
    const worker = await createWorker('eng+nor');

    // Use Jimp to read the image with new v1.x API
    const image = await Jimp.read(buffer);
    
    // Resize the image (new API uses object with width/height)
    image.resize({ w: 2000 }); // This will auto-calculate height to maintain aspect ratio

    // Get buffer from the image using new API
    const optimizedBuffer = await image.getBuffer('image/png');

    // Perform OCR
    const { data: { text, confidence } } = await worker.recognize(optimizedBuffer);

    // Terminate worker
    await worker.terminate();

    const date = extractDate(text);
    const amount = extractAmount(text);
    const description = extractDescription(text);

    let dataConfidence = 0;
    if (date) dataConfidence += 0.3;
    if (amount) dataConfidence += 0.4;
    if (description) dataConfidence += 0.3;

    const normalizedConfidence = confidence / 100;
    const finalConfidence = (dataConfidence + normalizedConfidence) / 2;

    return {
      date,
      amount,
      description,
      confidence: finalConfidence,
      method: 'ocr',
      currency: null,
      exchangeRate: null,
    };
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw error;
  }
}


export async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedDocumentData> {
  try {
    // Try PDF processing first for PDF files
    if (mimeType === 'application/pdf') {
      try {
        const pdfResult = await processPDF(buffer);
        // If PDF processing extracted enough data with good confidence, return it
        if (pdfResult.confidence > 0.7) {
          return pdfResult;
        }
      } catch (error) {
        console.log('PDF processing failed, falling back to OCR');
      }
    }

    // Fall back to OCR for images or if PDF processing failed
    if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
      return await processImage(buffer);
    }

    throw new Error('Unsupported file type');
  } catch (error) {
    console.error('Document processing failed:', error);
    // Return a structure for manual input
    return {
      date: null,
      amount: null,
      description: null,
      confidence: 0,
      method: 'manual',
      currency: null,
      exchangeRate: null,
    };
  }
}
