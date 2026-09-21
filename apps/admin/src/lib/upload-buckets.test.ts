import { describe, expect, it } from "bun:test";
import {
  DEFAULT_UPLOAD_BUCKET,
  decodeUploadFilename,
  resolveUploadBucket,
  resolveUploadMimeType,
  sanitizeUploadFilename,
} from "./upload-buckets";

describe("resolveUploadBucket", () => {
  it("defaults to the content bucket", () => {
    expect(resolveUploadBucket(DEFAULT_UPLOAD_BUCKET)?.id).toBe("content");
  });

  it("allows the public media bucket via the service key", () => {
    const bucket = resolveUploadBucket("media");
    expect(bucket?.client).toBe("admin");
    expect(bucket?.mimeTypes.has("image/png")).toBeTrue();
    expect(bucket?.mimeTypes.has("application/pdf")).toBeFalse();
  });

  it("rejects private and unknown buckets", () => {
    for (const bucketId of [
      "resumes",
      "expenses",
      "documents",
      "nope",
      "constructor",
      "__proto__",
    ]) {
      expect(resolveUploadBucket(bucketId)).toBeNull();
    }
  });
});

describe("upload filenames", () => {
  it("round-trips non-Latin-1 names sent URI-encoded", () => {
    const name = "Screenshot 2026-09-14 at 10.12.03\u202fAM.png";
    expect(decodeUploadFilename(encodeURIComponent(name))).toBe(name);
    expect(sanitizeUploadFilename(name)).toEndWith(".png");
  });

  it("falls back to the raw header when it isn't valid URI encoding", () => {
    expect(decodeUploadFilename("100%.png")).toBe("100%.png");
  });

  it("keeps the extension when truncating long names", () => {
    const sanitized = sanitizeUploadFilename(`${"a".repeat(300)}.jpeg`);
    expect(sanitized).toHaveLength(120);
    expect(sanitized).toEndWith(".jpeg");
  });
});

describe("resolveUploadMimeType", () => {
  it("prefers the blob's own type", () => {
    expect(resolveUploadMimeType("image/png", "image/jpeg")).toBe("image/png");
  });

  it("falls back to the Content-Type header when the blob type is empty", () => {
    expect(resolveUploadMimeType("", "image/jpeg")).toBe("image/jpeg");
    expect(resolveUploadMimeType("", "Image/PNG; charset=binary")).toBe(
      "image/png"
    );
  });

  it("defaults to octet-stream when neither is present", () => {
    expect(resolveUploadMimeType("", null)).toBe("application/octet-stream");
  });
});
