"use client";

import type { Documents } from "@repo/api/types/appwrite";
import { displayDocumentVersion } from "@repo/shared/utils/document-version";
import { Building2, FileText, Globe } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { deleteDocument } from "../../_actions/documents";
import { DOCUMENTS_PAGE_SIZE } from "../../_actions/schemas";
import {
  ContentList,
  type ContentListLabels,
} from "../../_components/content-list";
import { StatusBadge } from "../../_components/status-badge";
import { STUDIO, StudioCrest } from "../../_components/studio";

const CATEGORY_LABELS: Record<string, string> = {
  "national-statutes": "National Statutes",
  "campus-bylaws": "Campus Bylaws",
  "code-of-conduct": "Code of Conduct",
  "business-regulations": "Business Regulations",
  "communication-guidelines": "Communication Guidelines",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentsListClientProps {
  initialDocuments: Documents[];
  labels: ContentListLabels;
  page: number;
  total: number;
}

async function removeDocument(id: string): Promise<boolean> {
  const result = await deleteDocument(id);
  if ("error" in result) {
    toast.error(result.error);
    return false;
  }
  toast.success("Document deleted");
  return true;
}

export function DocumentsListClient({
  initialDocuments,
  labels,
  page,
  total,
}: DocumentsListClientProps) {
  return (
    <ContentList
      basePath="/documents"
      createLabel="Upload first document"
      deleteItem={removeDocument}
      icon={FileText}
      items={initialDocuments}
      labels={labels}
      matches={(doc, search) =>
        doc.title.toLowerCase().includes(search.toLowerCase()) ||
        (doc.description ?? "").toLowerCase().includes(search.toLowerCase())
      }
      noMatchingTitle="No matching documents"
      page={page}
      pageSize={DOCUMENTS_PAGE_SIZE}
      renderBody={(doc) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="truncate font-medium text-sm transition-colors hover:text-[#3DA9E0]"
              href={`/documents/${doc.$id}`}
              style={{ color: STUDIO.ink }}
            >
              {doc.title}
            </Link>
            <StatusBadge status={doc.status} />
            {doc.scope === "campus" && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: "rgba(42,74,122,0.08)",
                  color: STUDIO.sky,
                  border: "0.5px solid rgba(42,74,122,0.2)",
                }}
              >
                <Building2 size={10} />
                Campus
              </span>
            )}
            {doc.scope === "national" && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{
                  background: STUDIO.paper2,
                  color: STUDIO.ink3,
                  border: `0.5px solid ${STUDIO.rule2}`,
                }}
              >
                <Globe size={10} />
                National
              </span>
            )}
          </div>
          <div
            className="mt-1 flex flex-wrap items-center gap-3 text-xs"
            style={{ color: STUDIO.ink4 }}
          >
            <span>{CATEGORY_LABELS[doc.category] ?? doc.category}</span>
            <span>·</span>
            <span>{displayDocumentVersion(doc.version) ?? "—"}</span>
            <span>·</span>
            <span>{formatBytes(doc.file_size)}</span>
            <span>·</span>
            <span>{new Date(doc.$updatedAt).toLocaleDateString()}</span>
          </div>
        </>
      )}
      renderLead={(doc) => <StudioCrest icon={FileText} label={doc.title} />}
      total={total}
    />
  );
}
