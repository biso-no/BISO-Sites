import { describe, expect, test } from "bun:test";
import { isUploadDone } from "./files";

describe("isUploadDone", () => {
  test("accepts the live API's Processed as well as the spec's Completed", () => {
    expect(isUploadDone("Processed", 4246)).toBe(true);
    expect(isUploadDone("Completed", 4246)).toBe(true);
  });

  test("waits while pending, on failure, or without a document id", () => {
    expect(isUploadDone("Pending", null)).toBe(false);
    expect(isUploadDone("Failed", null)).toBe(false);
    expect(isUploadDone("Processed", null)).toBe(false);
    expect(isUploadDone(undefined, undefined)).toBe(false);
  });
});
