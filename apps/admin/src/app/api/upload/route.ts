import { ID } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
]);

const FILENAME_REGEX = /[^a-z0-9._-]/gi;

function sanitizeFilename(name: string | undefined): string {
  const fallback = "upload.bin";
  if (!name) {
    return fallback;
  }
  const cleaned = name.replace(FILENAME_REGEX, "_").slice(0, 120);
  return cleaned || fallback;
}

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const blob = await request.blob();
  if (blob.size === 0) {
    return NextResponse.json({ error: "Empty upload" }, { status: 400 });
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const mimeType = blob.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 }
    );
  }

  const filename = sanitizeFilename(
    request.headers.get("x-filename") ?? undefined
  );

  const { storage } = await createSessionClient();
  const file = await storage.createFile({
    bucketId: "content",
    fileId: ID.unique(),
    file: InputFile.fromBuffer(blob, filename),
  });
  return NextResponse.json({ file });
}
