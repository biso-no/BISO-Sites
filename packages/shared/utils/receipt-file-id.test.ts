import { describe, expect, it } from "vitest";
import { receiptFileId } from "./receipt-file-id";

describe("receiptFileId", () => {
  it("reads the same file id out of a bare id and the view url that wraps it", () => {
    // Older rows stored the full view URL. Both forms have to resolve to one
    // id, or a reference check comparing raw strings misses the legacy row.
    expect(receiptFileId("file-1")).toBe("file-1");
    expect(receiptFileId(" file-1 ")).toBe("file-1");
    expect(
      receiptFileId(
        "https://appwrite.biso.no/v1/storage/buckets/expenses/files/file-1/view?project=biso"
      )
    ).toBe("file-1");
    expect(
      receiptFileId(
        "https://appwrite.biso.no/v1/storage/buckets/expenses/files/file-1/preview"
      )
    ).toBe("file-1");
    expect(
      receiptFileId(
        "https://appwrite.biso.no/v1/storage/buckets/expenses/files/file%2D1/download"
      )
    ).toBe("file-1");
  });

  it("resolves nothing for values that name no file", () => {
    expect(receiptFileId(null)).toBeNull();
    expect(receiptFileId("")).toBeNull();
    expect(receiptFileId("   ")).toBeNull();
    expect(receiptFileId("https://example.com/not-a-receipt.png")).toBeNull();
    expect(
      receiptFileId(
        "https://appwrite.biso.no/v1/storage/buckets/expenses/files/has spaces/view"
      )
    ).toBeNull();
  });
});
