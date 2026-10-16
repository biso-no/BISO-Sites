import "server-only";
import { Buffer } from "node:buffer";

interface PdfTextItem {
  str: string;
}

type PdfInput = ArrayBuffer | Uint8Array | Buffer;
interface PdfDocument {
  destroy: () => Promise<void>;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{ items: unknown[] }>;
  }>;
  numPages: number;
}

interface PdfJsModule {
  getDocument: (options: {
    data: Uint8Array;
    isEvalSupported: boolean;
    useWorkerFetch: boolean;
  }) => {
    destroy: () => void;
    promise: Promise<PdfDocument>;
  };
}

function isNodeBuffer(value: PdfInput): value is Buffer {
  return Buffer.isBuffer(value);
}

function toUint8Array(input: PdfInput): Uint8Array {
  if (isNodeBuffer(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
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
  const pdfjsLib = (await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  )) as PdfJsModule;

  // Under Node, pdfjs runs its worker in-process and points
  // `GlobalWorkerOptions.workerSrc` at its bundled worker itself — overriding
  // it breaks the fake worker, so leave it alone.
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  let pdf: PdfDocument | null = null;

  try {
    pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: unknown) => {
          if (
            typeof item === "object" &&
            item !== null &&
            "str" in item &&
            typeof (item as PdfTextItem).str === "string"
          ) {
            return (item as PdfTextItem).str;
          }
          return "";
        })
        .join(" ")
        .trim();

      if (pageText) {
        pages.push(pageText);
      }
    }

    return pages.join("\n\n");
  } finally {
    if (pdf) {
      await pdf.destroy();
    }
    loadingTask.destroy();
  }
}
