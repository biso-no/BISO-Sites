"use client";

import type { DocumentItem, DocumentsBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: DocumentsBlock; doc: PageDoc; onPatch: PatchFn; }

export function DocumentsInspector({ block, onPatch }: Props) {
  const items = block.items ?? [];

  function patchItem(i: number, patch: Partial<DocumentItem>) {
    onPatch("items", items.map((x, j) => j === i ? { ...x, ...patch } : x));
  }

  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input value={block.heading ?? ""} onChange={(e) => onPatch("heading", e.target.value)} placeholder="Documents" />
        </InspRow>
      </InspSection>
      <InspSection label={`Files (${items.length})`}>
        {items.map((item, i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: "0.5px solid var(--rule)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{item.title}</span>
              <button
                type="button"
                onClick={() => onPatch("items", items.filter((_, j) => j !== i))}
                style={{ width: 18, height: 18, borderRadius: "50%", border: 0, background: "var(--rule-2)", cursor: "pointer", fontSize: 9, display: "grid", placeItems: "center" }}
                aria-label="Remove"
              >✕</button>
            </div>
            <InspRow label="Title"><input value={item.title} onChange={(e) => patchItem(i, { title: e.target.value })} /></InspRow>
            <InspRow label="File ID"><input value={item.fileId} onChange={(e) => patchItem(i, { fileId: e.target.value })} placeholder="Appwrite file ID" /></InspRow>
            <InspRow label="Size"><input value={item.size ?? ""} onChange={(e) => patchItem(i, { size: e.target.value || undefined })} placeholder="e.g. 2.4 MB" /></InspRow>
          </div>
        ))}
        <button
          type="button"
          style={{ fontSize: 12, marginTop: 8, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
          onClick={() => onPatch("items", [...items, { title: "Document title", fileId: "" }])}
        >+ Add document</button>
      </InspSection>
    </>
  );
}
