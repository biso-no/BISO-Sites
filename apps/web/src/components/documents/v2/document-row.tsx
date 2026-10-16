import { displayDocumentVersion } from "@repo/shared/utils/document-version";
import { ChevronDown, Download, ExternalLink } from "lucide-react";
import { Pill } from "@/components/ui/pill";
import type { PublicDocument } from "@/lib/documents";
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

/** "oktober 2026" / "October 2026". */
function monthYear(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "no" ? "nb-NO" : "en-GB", {
    month: "long",
    year: "numeric",
  });
}

/** Pre-translated by the page, so this row needs no translator of its own. */
export interface DocumentRowLabels {
  campus: string;
  category: (value: string) => string;
  download: string;
  previousVersions: (count: number) => string;
  updated: (date: string) => string;
  view: string;
}

const linkFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

/**
 * One document: what it is, which version is current, and the two things you
 * can do with it — plus every earlier version, each downloadable on its own.
 *
 * A Server Component. The pre-redesign row was `"use client"` for a hover
 * colour and a history toggle held in `useState`, painted with inline
 * `rgba(255,…)` literals that only worked against the page's hardcoded navy
 * gradient. The history is a native `<details>` disclosure now: keyboard and
 * screen-reader support come with the element, and it works without script.
 */
export function DocumentRow({
  doc,
  labels,
  locale,
}: {
  doc: PublicDocument;
  labels: DocumentRowLabels;
  locale: string;
}) {
  const facts = [
    // "v12" for a version number, the text itself for a legacy value.
    displayDocumentVersion(doc.version),
    formatBytes(doc.file_size),
    labels.category(doc.category),
    labels.updated(monthYear(doc.$updatedAt, locale)),
  ].filter(Boolean) as string[];

  return (
    <li className="border-edge border-b py-6 last:border-b-0">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* `h2`: the rows sit straight under the page's `<h1>`, with no
                section heading between them. */}
            <h2 className="type-heading-card min-w-0 break-words text-ink">
              {doc.title}
            </h2>
            {doc.scope === "campus" && doc.campus_id ? (
              <Pill tone="accent">{labels.campus}</Pill>
            ) : null}
          </div>
          {doc.description ? (
            <p className="type-body mt-2 max-w-(--measure) text-ink-muted">
              {doc.description}
            </p>
          ) : null}
          <p className="type-body-sm mt-3 text-ink-muted">
            {facts.join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {doc.sharepoint_web_url ? (
            <a
              className={`inline-flex items-center gap-2 rounded-biso-sm border border-edge px-4 py-2 text-ink transition-colors hover:border-ink-accent hover:text-ink-accent ${linkFocus}`}
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
      </div>

      {doc.previousVersions.length > 0 ? (
        <details className="group/versions mt-4">
          <summary
            className={`type-body-sm inline-flex cursor-pointer list-none items-center gap-2 rounded-biso-sm text-ink-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden ${linkFocus}`}
          >
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform group-open/versions:rotate-180"
            />
            {labels.previousVersions(doc.previousVersions.length)}
          </summary>
          <ul className="mt-3 max-w-(--measure)">
            {doc.previousVersions.map((version) => {
              const size = formatBytes(version.fileSize);
              return (
                <li
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-edge border-t py-2"
                  key={version.id}
                >
                  <span className="type-body-sm text-ink-muted">
                    {[
                      `v${version.label}`,
                      size,
                      monthYear(version.createdAt, locale),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <a
                    className={`type-body-sm inline-flex items-center gap-1.5 rounded-biso-sm text-ink-accent underline underline-offset-4 hover:no-underline ${linkFocus}`}
                    download
                    href={`/api/documents/${doc.$id}/download?version=${version.id}`}
                  >
                    <Download aria-hidden="true" className="size-4 shrink-0" />
                    {labels.download}
                    <span className="sr-only">
                      {` ${doc.title} v${version.label}`}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
