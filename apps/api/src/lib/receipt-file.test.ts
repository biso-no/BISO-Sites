import { afterEach, describe, expect, it, vi } from "vitest";
import {
  receiptFileName,
  receiptViewUrl,
  sniffReceiptMimeType,
} from "./receipt-file";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);
const HEIC = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);

describe("sniffReceiptMimeType", () => {
  it("recognises the formats the ledger merge can embed", () => {
    expect(sniffReceiptMimeType(PDF)).toBe("application/pdf");
    expect(sniffReceiptMimeType(PNG)).toBe("image/png");
    expect(sniffReceiptMimeType(JPEG)).toBe("image/jpeg");
  });

  it("rejects anything else, whatever it claims to be", () => {
    expect(sniffReceiptMimeType(HEIC)).toBeNull();
    expect(sniffReceiptMimeType(new Uint8Array())).toBeNull();
  });
});

describe("receiptFileName", () => {
  it("gives the stored file an extension matching its real type", () => {
    expect(receiptFileName("IMG_0001.HEIC", "image/jpeg")).toBe("IMG_0001.jpg");
    expect(receiptFileName("kvittering.pdf", "application/pdf")).toBe("kvittering.pdf");
    expect(receiptFileName("", "image/png")).toBe("receipt.png");
    expect(receiptFileName("../../etc/passwd", "image/png")).toBe("passwd.png");
  });
});

describe("receiptViewUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("points at the expenses bucket on the configured Appwrite project", () => {
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", "https://appwrite.example/v1/");
    vi.stubEnv("NEXT_PUBLIC_APPWRITE_PROJECT", "biso-test");

    expect(receiptViewUrl("file-1")).toBe(
      "https://appwrite.example/v1/storage/buckets/expenses/files/file-1/view?project=biso-test"
    );
  });
});
