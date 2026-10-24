"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { Download } from "lucide-react";

/**
 * The one interactive part of a document row: the tracked download.
 *
 * A client island of nine lines, so the row itself — title, description,
 * category, size, date, and the SharePoint "view" link — stays a Server
 * Component. Previously the whole list, the whole row and the whole hero were
 * client-side to support a hover colour and an analytics call.
 */
export function DocumentDownload({
  documentId,
  label,
  title,
}: {
  documentId: string;
  label: string;
  title: string;
}) {
  return (
    <a
      className="inline-flex items-center gap-2 rounded-biso-sm bg-action px-4 py-2 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      download
      href={`/api/documents/${documentId}/download`}
      onClick={() => trackEvent("document_download", { documentId, title })}
    >
      <Download aria-hidden="true" className="size-4 shrink-0" />
      <span className="type-body-sm">{label}</span>
    </a>
  );
}
