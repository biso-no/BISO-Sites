"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { DocumentItem, DocumentsBlock, PageDoc } from "@/editor/types";

interface Props {
  block: DocumentsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function DocumentsInspector({ block, onPatch }: Props) {
  const items = block.items ?? [];

  function patchItem(i: number, patch: Partial<DocumentItem>) {
    onPatch(
      "items",
      items.map((x, j) => (j === i ? { ...x, ...patch } : x))
    );
  }

  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            placeholder="Documents"
            value={block.heading ?? ""}
          />
        </InspRow>
      </InspSection>
      <InspSection label={`Files (${items.length})`}>
        {items.map((item, i) => (
          <div
            key={i}
            style={{
              padding: "8px 0",
              borderBottom: "0.5px solid var(--rule)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {item.title}
              </span>
              <button
                aria-label="Remove"
                onClick={() =>
                  onPatch(
                    "items",
                    items.filter((_, j) => j !== i)
                  )
                }
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: 0,
                  background: "var(--rule-2)",
                  cursor: "pointer",
                  fontSize: 9,
                  display: "grid",
                  placeItems: "center",
                }}
                type="button"
              >
                ✕
              </button>
            </div>
            <InspRow label="Title">
              <input
                onChange={(e) => patchItem(i, { title: e.target.value })}
                value={item.title}
              />
            </InspRow>
            <InspRow label="File ID">
              <input
                onChange={(e) => patchItem(i, { fileId: e.target.value })}
                placeholder="Appwrite file ID"
                value={item.fileId}
              />
            </InspRow>
            <InspRow label="Size">
              <input
                onChange={(e) =>
                  patchItem(i, { size: e.target.value || undefined })
                }
                placeholder="e.g. 2.4 MB"
                value={item.size ?? ""}
              />
            </InspRow>
          </div>
        ))}
        <button
          onClick={() =>
            onPatch("items", [
              ...items,
              { title: "Document title", fileId: "" },
            ])
          }
          style={{
            fontSize: 12,
            marginTop: 8,
            padding: "4px 8px",
            border: "0.5px solid var(--rule-2)",
            borderRadius: 6,
            background: "var(--paper-2)",
            cursor: "pointer",
          }}
          type="button"
        >
          + Add document
        </button>
      </InspSection>
    </>
  );
}
