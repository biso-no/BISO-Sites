import 'server-only';
import { Buffer } from 'node:buffer';

type PdfTextItem = {
  str: string;
};

type PdfInput = ArrayBuffer | Uint8Array | Buffer;

function isNodeBuffer(value: PdfInput): value is Buffer {
  return Buffer.isBuffer(value);
}

function toUint8Array(input: PdfInput): Uint8Array {
  if (isNodeBuffer(input)) {
    return new Uint8Array(
      input.buffer,
      input.byteOffset,
      input.byteLength,
    );
  }
  if (input instanceof Uint8Array) {
    return input as Uint8Array;
  }
  return new Uint8Array(input);
}

/**
 * Extracts textual content from a PDF buffer using pdfjs-dist.
 * Accepts ArrayBuffer, Uint8Array, or Node Buffer inputs.
 */
export async function extractTextFromPdf(input: PdfInput): Promise<string> {
  const data = toUint8Array(input);
  const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Disable worker usage in Node environments where web workers are unavailable.
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = undefined;

  const loadingTask = pdfjsLib.getDocument({
    data,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  } as any);

  let pdf: any | null = null;

  try {
    pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map(item => ('str' in item ? (item as PdfTextItem).str : ''))
        .join(' ')
        .trim();

      if (pageText) {
        pages.push(pageText);
      }
    }

    return pages.join('\n\n');
  } catch (error) {
    throw error;
  } finally {
    if (pdf) {
      await pdf.destroy();
    }
    loadingTask.destroy();
  }
}
