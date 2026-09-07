import type { Documents } from "@repo/api/types/appwrite";
import { ExternalLink } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import { DocumentDownload } from "./document-download";

const KB = 1024;
const MB = KB * 1024;

function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes) {
    return null;
  }
  if (bytes < KB) {
    return `${bytes} B`;
  }
  if (bytes < MB) {
    return `${(bytes / KB).toFixed(1)} KB`;
  }
  return `${(bytes / MB).toFixed(1)} MB`;
}

export interface DocumentRowLabels {
  campus: string;
  category: (value: string) => string;
  download: string;
  updated: string;
  view: string;
}

/**
 * One document: what it is, and the two things you can do with it.
 *
 * A Server Component. The previous row was `"use client"` for a hover colour
 * driven by `useState`, and painted itself with eight inline `rgba(255,…)`
 * literals that only worked against the page's hardcoded navy gradient — the
 * reason this page could not inherit the theme.
 */
export function DocumentRow({
  doc,
  labels,
  locale,
}: {
  doc: Documents;
  labels: DocumentRowLabels;
  locale: string;
}) {
  const size = formatBytes(doc.file_size);
  const facts = [
    doc.version,
    size,
    labels.category(doc.category),
    `${labels.updated} ${new Date(doc.$updatedAt).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
    })}`,
  ].filter(Boolean) as string[];

  return (
    <li className="flex flex-col gap-4 border-edge border-b py-6 last:border-b-0 md:flex-row md:items-start md:justify-between md:gap-8">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="type-heading-card min-w-0 break-words text-ink">
            {doc.title}
          </h3>
          {doc.scope === "campus" && doc.campus_id ? (
            <Pill tone="accent">{labels.campus}</Pill>
          ) : null}
        </div>
        {doc.description ? (
          <p className="type-body mt-2 max-w-(--measure) text-ink-muted">
            {doc.description}
          </p>
        ) : null}
        <p className="type-body-sm mt-3 text-ink-muted">{facts.join(" · ")}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {doc.sharepoint_web_url ? (
          <a
            className="inline-flex items-center gap-2 rounded-biso-sm border border-edge px-4 py-2 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            href={doc.sharepoint_web_url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <span className="type-body-sm">{labels.view}</span>
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
          </a>
        ) : null}
        <DocumentDownload
          documentId={doc.$id}
          label={labels.download}
          title={doc.title}
        />
      </div>
    </li>
  );
}
