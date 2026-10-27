import { getStorageFileUrl, ID } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import type { UserAuthContext } from "@/lib/authorization";
import { handleChunkedUpload, isChunkRequest } from "@/lib/chunked-upload";
import {
  allowsChunkedUpload,
  DEFAULT_UPLOAD_BUCKET,
  decodeUploadFilename,
  filenameMatchesMime,
  maxBytesForMime,
  readContentLength,
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

  // The largest limit of any type bounds the body; the type's own limit
  // applies once it is known.
  const contentLength = readContentLength(request.headers);
  if (contentLength === null) {
    return NextResponse.json(
      { error: "Content-Length required" },
      { status: 411 }
    );
  }
  if (contentLength > bucket.maxBytes) {
    return tooLarge(bucket.maxBytes);
  }

  const blob = await request.blob();
  if (blob.size === 0) {
    return NextResponse.json({ error: "Empty upload" }, { status: 400 });
  }

  const mimeType = resolveUploadMimeType(
    blob.type,
    request.headers.get("content-type")
  );
  const typeLimit = maxBytesForMime(bucket, mimeType);
  if (typeLimit === null) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 }
    );
  }
  if (blob.size > typeLimit) {
    return tooLarge(typeLimit);
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
