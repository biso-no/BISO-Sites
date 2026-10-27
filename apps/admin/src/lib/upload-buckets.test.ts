import { describe, expect, it } from "bun:test";
import {
  allowsChunkedUpload,
  DEFAULT_UPLOAD_BUCKET,
  decodeUploadFilename,
  filenameMatchesMime,
  maxBytesForMime,
  mimeFromFilename,
  readContentLength,
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
  });

  it("takes the document types the Documents block offers", () => {
    const bucket = resolveUploadBucket("media");
    for (const type of [
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/vnd.ms-excel",
      "application/msword",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]) {
      expect(bucket?.mimeTypes.has(type)).toBeTrue();
    }
  });

  it("rejects executables, archives and html even though the bucket takes zip", () => {
    const bucket = resolveUploadBucket("media");
    for (const type of [
      "application/x-msdownload",
      "application/x-sh",
      "application/zip",
      "application/x-zip-compressed",
      "text/html",
      "application/octet-stream",
    ]) {
      expect(bucket?.mimeTypes.has(type)).toBeFalse();
    }
  });

  it("accepts the video types the editor offers for upload", () => {
    // The video block invites an mp4/mov upload, but the route answered 415.
    const bucket = resolveUploadBucket("media");
    for (const type of ["video/mp4", "video/quicktime", "video/webm"]) {
      expect(bucket?.mimeTypes.has(type)).toBeTrue();
    }
  });

  it("rejects what the bucket itself would refuse", () => {
    // The `media` bucket's allowed extensions have no avif, so accepting it
    // here only moves the failure from a clear 415 to a vague 502.
    expect(
      resolveUploadBucket("media")?.mimeTypes.has("image/avif")
    ).toBeFalse();
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

describe("per-type size limits", () => {
  const MB = 1024 * 1024;
  const media = resolveUploadBucket("media");

  it("allows 25 MB for a PDF, 10 MB for an image, 250 MB for a video", () => {
    expect(media && maxBytesForMime(media, "application/pdf")).toBe(25 * MB);
    expect(media && maxBytesForMime(media, "image/png")).toBe(10 * MB);
    expect(media && maxBytesForMime(media, "video/mp4")).toBe(250 * MB);
  });

  it("has no limit for a type the bucket does not take", () => {
    expect(
      media && maxBytesForMime(media, "application/x-msdownload")
    ).toBeNull();
  });

  it("keeps the content bucket at 10 MB", () => {
    const content = resolveUploadBucket("content");
    expect(content && maxBytesForMime(content, "application/pdf")).toBe(
      10 * MB
    );
  });

  it("caps the whole request at the largest per-type limit", () => {
    expect(media?.maxBytes).toBe(250 * MB);
  });
});

describe("mimeFromFilename", () => {
  it("names a document the browser reported no type for", () => {
    expect(mimeFromFilename("Budsjett.CSV")).toBe("text/csv");
    expect(mimeFromFilename("Vedtekter.pdf")).toBe("application/pdf");
    expect(mimeFromFilename("a.docx")).toContain("wordprocessingml");
  });

  it("does not guess for anything else", () => {
    expect(mimeFromFilename("run.exe")).toBeNull();
    expect(mimeFromFilename("noextension")).toBeNull();
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

describe("allowsChunkedUpload", () => {
  it("chunks only buckets already written with the service key", () => {
    // The chunk forwarder uploads with the service key, so a bucket the
    // editor's own session writes to must not gain it through chunking.
    const media = resolveUploadBucket("media");
    const content = resolveUploadBucket("content");
    expect(media && allowsChunkedUpload(media)).toBeTrue();
    expect(content && allowsChunkedUpload(content)).toBeFalse();
  });
});

describe("filenameMatchesMime", () => {
  it("accepts a name whose extension carries the declared type", () => {
    expect(filenameMatchesMime("Min_film.MP4", "video/mp4")).toBeTrue();
    expect(filenameMatchesMime("clip.mov", "video/quicktime")).toBeTrue();
    expect(filenameMatchesMime("photo.jpeg", "image/jpeg")).toBeTrue();
    expect(filenameMatchesMime("report.pdf", "application/pdf")).toBeTrue();
    // Windows reports CSV as Excel.
    expect(
      filenameMatchesMime("list.csv", "application/vnd.ms-excel")
    ).toBeTrue();
  });

  it("refuses a name that disagrees with the declared type", () => {
    expect(filenameMatchesMime("archive.zip", "video/mp4")).toBeFalse();
    expect(filenameMatchesMime("photo.png", "video/mp4")).toBeFalse();
    expect(filenameMatchesMime("clip.mp4", "image/png")).toBeFalse();
    expect(filenameMatchesMime("noextension", "video/mp4")).toBeFalse();
    expect(filenameMatchesMime("clip.exe", "video/mp4")).toBeFalse();
  });
});

describe("readContentLength", () => {
  const headers = (value?: string) =>
    new Headers(value === undefined ? {} : { "content-length": value });

  it("reads a positive byte count", () => {
    expect(readContentLength(headers("5242880"))).toBe(5_242_880);
  });

  it("is null when the length is missing, not a number, or not positive", () => {
    for (const value of [undefined, "", "abc", "12.5", "-1", "0", "1e6"]) {
      expect(readContentLength(headers(value))).toBeNull();
    }
  });
});
