import { getStorageFileUrl, ID } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { MEDIA_BUCKET_ID } from "@/app/(portal)/_actions/schemas";
import { requireApiAuth } from "@/lib/api-auth";
import {
  type ChunkUploadPolicy,
  type CompletedChunkUpload,
  handleChunkedUpload,
  isChunkRequest,
} from "@/lib/chunked-upload";
import {
  classifyInlineMedia,
  INLINE_MEDIA_MAX_BYTES,
  type InlineMediaKind,
  type InlineMediaUpload,
  sanitizeInlineMediaFilename,
} from "@/lib/inline-media";

export interface InlineMediaUploadInput {
  bytes: Buffer;
  fileName: string;
  mediaKind: InlineMediaKind;
  mimeType: string;
  size: number;
}

interface InlineMediaUploadDependencies {
  authenticate: () => Promise<boolean>;
  createFile: (input: InlineMediaUploadInput) => Promise<unknown>;
}

function errorResponse(error: string, status: number): Response {
  return NextResponse.json({ error }, { status });
}

function decodeFilename(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export async function handleInlineMediaUpload(
  request: Request,
  dependencies: InlineMediaUploadDependencies
): Promise<Response> {
  if (!(await dependencies.authenticate())) {
    return errorResponse("Unauthorized", 401);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > INLINE_MEDIA_MAX_BYTES) {
    return errorResponse("File too large (max 250 MB)", 413);
  }

  const decodedFilename = decodeFilename(
    request.headers.get("x-filename") ?? "upload"
  );
  if (decodedFilename === null) {
    return errorResponse("Unsupported or mismatched file type", 415);
  }

  const fileName = sanitizeInlineMediaFilename(decodedFilename);
  const mimeType = request.headers.get("content-type") ?? "";
  const mediaKind = classifyInlineMedia(fileName, mimeType);
  if (!mediaKind) {
    return errorResponse("Unsupported or mismatched file type", 415);
  }

  const blob = await request.blob();
  if (blob.size === 0) {
    return errorResponse("Empty upload", 400);
  }
  if (blob.size > INLINE_MEDIA_MAX_BYTES) {
    return errorResponse("File too large (max 250 MB)", 413);
  }

  const storageResponse = await dependencies.createFile({
    bytes: Buffer.from(await blob.arrayBuffer()),
    fileName,
    mediaKind,
    mimeType,
    size: blob.size,
  });

  if (!(storageResponse instanceof Response)) {
    return errorResponse("Upload failed", 500);
  }
  return storageResponse;
}

/** Files over 5 MiB arrive in chunks (`?chunk=1`), under the same rules. */
const INLINE_MEDIA_CHUNK_POLICY: ChunkUploadPolicy = {
  bucketId: MEDIA_BUCKET_ID,
  limitFor: (mime, filename) =>
    classifyInlineMedia(filename, mime) ? INLINE_MEDIA_MAX_BYTES : null,
};

function completedInlineMedia({
  fileId,
  filename,
  mime,
  total,
  url,
}: CompletedChunkUpload): Response {
  const file: InlineMediaUpload = {
    fileId,
    fileName: filename,
    // The policy refused anything unclassified before the first chunk.
    mediaKind: classifyInlineMedia(filename, mime) ?? "file",
    mimeType: mime,
    size: total,
    url,
  };
  return NextResponse.json({ file });
}

export async function POST(request: Request): Promise<Response> {
  if (isChunkRequest(request)) {
    const auth = await requireApiAuth();
    if (auth.response) {
      return auth.response;
    }
    return await handleChunkedUpload(request, {
      complete: completedInlineMedia,
      policy: INLINE_MEDIA_CHUNK_POLICY,
      userId: auth.ctx.userId,
    });
  }
  return await handleInlineMediaUpload(request, {
    authenticate: async () => {
      const auth = await requireApiAuth();
      return !auth.response;
    },
    createFile: async ({ bytes, fileName, mediaKind, mimeType, size }) => {
      const { storage } = await createAdminClient();
      const uploaded = await storage.createFile({
        bucketId: MEDIA_BUCKET_ID,
        file: InputFile.fromBuffer(bytes, fileName),
        fileId: ID.unique(),
      });

      return NextResponse.json({
        file: {
          fileId: uploaded.$id,
          fileName,
          mediaKind,
          mimeType,
          size,
          url: getStorageFileUrl(MEDIA_BUCKET_ID, uploaded.$id),
        },
      });
    },
  });
}
