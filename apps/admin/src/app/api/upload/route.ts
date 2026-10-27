import { getStorageFileUrl, ID } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import type { UserAuthContext } from "@/lib/authorization";
import { handleChunkedUpload, isChunkRequest } from "@/lib/chunked-upload";
import { readCapped } from "@/lib/read-capped";
import {
  allowsChunkedUpload,
  DEFAULT_UPLOAD_BUCKET,
  decodeUploadFilename,
  filenameMatchesMime,
  maxBytesForMime,
  resolveUploadBucket,
  resolveUploadMimeType,
  sanitizeUploadFilename,
  type UploadBucketConfig,
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
 *
 * `?chunk=1` switches to chunk mode for files over 5 MiB, in buckets that
 * allow it (`allowsChunkedUpload`): see `lib/chunked-upload.ts`. The chunk
 * that completes the file answers `{ fileId, url }`, the same `/view` url as
 * a single request.
 */

function tooLarge(maxBytes: number) {
  return NextResponse.json(
    { error: `File too large (max ${maxBytes / 1024 / 1024} MB)` },
    { status: 413 }
  );
}

function chunkedUpload(
  request: Request,
  bucket: UploadBucketConfig,
  ctx: UserAuthContext
): Promise<Response> | Response {
  if (!allowsChunkedUpload(bucket)) {
    return NextResponse.json(
      { error: "This bucket takes files in one request" },
      { status: 400 }
    );
  }
  return handleChunkedUpload(request, {
    complete: ({ fileId, url }) => NextResponse.json({ fileId, url }),
    ctx,
    policy: {
      bucketId: bucket.id,
      // The name must agree with the type, or a `.zip` declared as
      // `video/mp4` would get the video limit.
      limitFor: (mime, filename) =>
        filenameMatchesMime(filename, mime)
          ? maxBytesForMime(bucket, mime)
          : null,
    },
  });
}

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

  if (isChunkRequest(request)) {
    return chunkedUpload(request, bucket, auth.ctx);
  }

  // The type and name come from the headers, so the type's own limit caps
  // the read: a larger declared length is refused unread, and a body that
  // runs past it is cut off there.
  const mimeType = resolveUploadMimeType(
    "",
    request.headers.get("content-type")
  );
  const typeLimit = maxBytesForMime(bucket, mimeType);
  const filename = sanitizeUploadFilename(
    decodeUploadFilename(request.headers.get("x-filename"))
  );
  if (typeLimit === null || !filenameMatchesMime(filename, mimeType)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 }
    );
  }

  const body = await readCapped(request, typeLimit);
  if (body.tooLarge) {
    return tooLarge(typeLimit);
  }
  const { bytes } = body;
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "Empty upload" }, { status: 400 });
  }

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
      file: InputFile.fromBuffer(bytes, filename),
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
      size: bytes.byteLength,
      userId: auth.ctx.userId,
    });
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 502 }
    );
  }
}
