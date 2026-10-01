import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import type { Documents, DocumentVersions } from "@repo/api/types/appwrite";
import {
  getSharePointConfig,
  SharePointService,
} from "@repo/connectors/sharepoint";
import { formatDocumentVersion } from "@repo/shared/utils/document-version";
import { type NextRequest, NextResponse } from "next/server";

// A literal space, not \s: tabs and line breaks must never reach the header.
const UNSAFE_FILE_NAME_CHARS_REGEX = /[^a-z0-9 æøå.-]/gi;
const NON_ASCII_REGEX = /[^\x20-\x7E]/g;

/**
 * RFC 6266 header with both forms: an ASCII `filename` for old clients and an
 * RFC 5987 `filename*` that carries the real name, Norwegian letters included.
 */
function attachmentDisposition(name: string): string {
  const safeName = name.replace(UNSAFE_FILE_NAME_CHARS_REGEX, "_").trim();
  const asciiName = safeName.replace(NON_ASCII_REGEX, "_");
  return `attachment; filename="${asciiName}.pdf"; filename*=UTF-8''${encodeURIComponent(safeName)}.pdf`;
}

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const versionId = req.nextUrl.searchParams.get("version");

  try {
    const { db } = await createSessionClient();
    const result = await db.listRows<Documents>("app", "documents", [
      Query.equal("$id", id),
      Query.equal("status", "published"),
      Query.limit(1),
    ]);

    const doc = result.rows[0];
    if (!doc) {
      return notFound();
    }

    let driveId = doc.sharepoint_drive_id;
    let itemId = doc.sharepoint_item_id;
    let fileName = doc.title;

    if (versionId) {
      // Scoped to this published document, so a version id cannot be used to
      // reach another document's file.
      const versions = await db.listRows<DocumentVersions>(
        "app",
        "document_versions",
        [
          Query.equal("$id", versionId),
          Query.equal("document_id", id),
          Query.limit(1),
        ]
      );
      const version = versions.rows[0];
      if (!version) {
        return notFound();
      }
      driveId = version.sharepoint_drive_id;
      itemId = version.sharepoint_item_id;
      const label = formatDocumentVersion({
        major: version.version_major,
        minor: version.version_minor,
      });
      fileName = `${doc.title} v${label}`;
    }

    const sp = new SharePointService(getSharePointConfig());
    const buffer = await sp.downloadDocument(driveId, itemId);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": attachmentDisposition(fileName),
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
