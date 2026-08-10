import { expect, test } from "bun:test";
import { uploadInlineMedia } from "../app/(portal)/_components/inline-media-upload";
import {
  classifyInlineMedia,
  INLINE_MEDIA_MAX_BYTES,
  sanitizeInlineMediaFilename,
} from "./inline-media";

test.each([
  ["photo.jpg", "image/jpeg", "image"],
  ["photo.jpeg", "image/jpeg", "image"],
  ["photo.png", "image/png", "image"],
  ["photo.gif", "image/gif", "image"],
  ["photo.webp", "image/webp", "image"],
  ["clip.mp4", "video/mp4", "video"],
  ["clip.webm", "video/webm", "video"],
  ["voice.mp3", "audio/mpeg", "audio"],
  ["voice.wav", "audio/wav", "audio"],
  ["voice.ogg", "audio/ogg", "audio"],
  ["guide.pdf", "application/pdf", "file"],
] as const)("classifies %s", (filename, mimeType, expected) => {
  expect(classifyInlineMedia(filename, mimeType)).toBe(expected);
});

test("rejects active and mismatched content", () => {
  expect(classifyInlineMedia("page.html", "text/html")).toBeNull();
  expect(classifyInlineMedia("vector.svg", "image/svg+xml")).toBeNull();
  expect(classifyInlineMedia("photo.jpg", "application/javascript")).toBeNull();
  expect(classifyInlineMedia("clip.mp4", "audio/mpeg")).toBeNull();
});

test("classifies case-insensitive extensions and MIME tokens", () => {
  expect(classifyInlineMedia("PHOTO.JPEG", "IMAGE/JPEG")).toBe("image");
});

test("keeps the Appwrite bucket ceiling", () => {
  expect(INLINE_MEDIA_MAX_BYTES).toBe(10 * 1024 * 1024);
});

test("sanitizes untrusted filenames for Appwrite", () => {
  expect(sanitizeInlineMediaFilename("../Board photo (final).jpg")).toBe(
    ".._Board_photo__final_.jpg"
  );
  expect(sanitizeInlineMediaFilename("<>\u0000")).toBe("___");
  expect(sanitizeInlineMediaFilename("")).toBe("upload");
});

test("uploads the raw file and returns the validated media DTO", async () => {
  const file = new File(["photo"], "Board photo.jpg", {
    type: "image/jpeg",
  });
  let capturedInput: RequestInfo | URL | undefined;
  let capturedInit: RequestInit | undefined;

  const uploaded = await uploadInlineMedia(file, (input, init) => {
    capturedInput = input;
    capturedInit = init;
    return Promise.resolve(
      Response.json({
        file: {
          fileId: "file-1",
          fileName: "Board_photo.jpg",
          mediaKind: "image",
          mimeType: "image/jpeg",
          size: 5,
          url: "https://cloud.appwrite.test/file-1",
        },
      })
    );
  });

  expect(uploaded).toEqual({
    fileId: "file-1",
    fileName: "Board_photo.jpg",
    mediaKind: "image",
    mimeType: "image/jpeg",
    size: 5,
    url: "https://cloud.appwrite.test/file-1",
  });
  expect(capturedInput).toBe("/api/media/upload");
  expect(capturedInit?.method).toBe("POST");
  expect(capturedInit?.body).toBe(file);
  expect(capturedInit?.headers).toEqual({
    "content-type": "image/jpeg",
    "x-filename": "Board%20photo.jpg",
  });
});

test("throws the server upload error", async () => {
  const file = new File(["script"], "page.html", { type: "text/html" });

  await expect(
    uploadInlineMedia(file, () =>
      Promise.resolve(
        Response.json(
          { error: "Unsupported or mismatched file type" },
          { status: 415 }
        )
      )
    )
  ).rejects.toThrow("Unsupported or mismatched file type");
});

test("rejects a malformed successful upload response", async () => {
  const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });

  await expect(
    uploadInlineMedia(file, () =>
      Promise.resolve(
        Response.json({
          file: { id: "bad" },
        })
      )
    )
  ).rejects.toThrow("Invalid upload response");
});
