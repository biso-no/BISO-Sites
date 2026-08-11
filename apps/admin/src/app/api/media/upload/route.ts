import { getStorageFileUrl, ID } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient } from "@repo/api/server";
import { NextResponse } from "next/server";
import { MEDIA_BUCKET_ID } from "@/app/(portal)/_actions/schemas";
import { requireApiAuth } from "@/lib/api-auth";
import {
  classifyInlineMedia,
  INLINE_MEDIA_MAX_BYTES,
  type InlineMediaKind,
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
    return errorResponse("File too large (max 10 MB)", 413);
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
    return errorResponse("File too large (max 10 MB)", 413);
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

export function POST(request: Request): Promise<Response> {
  return handleInlineMediaUpload(request, {
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
