import { getStorageFileUrl, ID } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import {
  DEFAULT_UPLOAD_BUCKET,
  decodeUploadFilename,
  resolveUploadBucket,
  resolveUploadMimeType,
  sanitizeUploadFilename,
} from "@/lib/upload-buckets";

/**
 * Binary upload endpoint. Server Actions cap request bodies at 4 MB
 * (`next.config.ts#experimental.serverActions.bodySizeLimit`), so file uploads
 * go through this route handler instead.
 *
 * Body: the raw file (`fetch(url, { body: file })` sets Content-Type).
 * Headers: `x-filename` (optional).
 * Query: `bucket` (optional, defaults to "content"). Only buckets listed in
 * `UPLOAD_BUCKETS` are accepted — private buckets (resumes, expenses) are not.
 */

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const bucketParam = new URL(request.url).searchParams.get("bucket");
  const bucket = resolveUploadBucket(bucketParam ?? DEFAULT_UPLOAD_BUCKET);
  if (!bucket) {
    return NextResponse.json(
      { error: "Uploads to this bucket are not allowed" },
      { status: 400 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > bucket.maxBytes) {
    return NextResponse.json(
      { error: `File too large (max ${bucket.maxBytes / 1024 / 1024} MB)` },
      { status: 413 }
    );
  }

  const blob = await request.blob();
  if (blob.size === 0) {
    return NextResponse.json({ error: "Empty upload" }, { status: 400 });
  }
  if (blob.size > bucket.maxBytes) {
    return NextResponse.json(
      { error: `File too large (max ${bucket.maxBytes / 1024 / 1024} MB)` },
      { status: 413 }
    );
  }

  const mimeType = resolveUploadMimeType(
    blob.type,
    request.headers.get("content-type")
  );
  if (!bucket.mimeTypes.has(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 }
    );
  }

  const filename = sanitizeUploadFilename(
    decodeUploadFilename(request.headers.get("x-filename"))
  );

  try {
    // Buckets whose create permission is narrower than "any admin user" are
    // written with the service key; the auth check above gates access.
    const { storage } =
      bucket.client === "admin"
        ? await createAdminClient()
        : await createSessionClient();
    const file = await storage.createFile({
      bucketId: bucket.id,
      fileId: ID.unique(),
      file: InputFile.fromBuffer(blob, filename),
    });
    return NextResponse.json({
      file,
      fileId: file.$id,
      url: getStorageFileUrl(bucket.id, file.$id),
    });
  } catch (error) {
    console.error("[api/upload] createFile failed", {
      bucket: bucket.id,
      error,
      size: blob.size,
      userId: auth.ctx.userId,
    });
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 502 }
    );
  }
}
