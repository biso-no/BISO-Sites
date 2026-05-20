"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, ScrollRowBlock, ScrollRowItem } from "@/editor/types";

interface Props {
  block: ScrollRowBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function ScrollRowInspector({ block, onPatch }: Props) {
  function patchItem(i: number, patch: Partial<ScrollRowItem>) {
    onPatch(
      "items",
      block.items.map((x, j) => (j === i ? { ...x, ...patch } : x))
    );
  }
  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            placeholder="Benefits"
            value={block.heading ?? ""}
          />
        </InspRow>
      </InspSection>
      <InspSection label={`Cards (${block.items.length})`}>
        {block.items.map((item, i) => (
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
                    block.items.filter((_, j) => j !== i)
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
            <InspRow label="Icon">
              <input
                onChange={(e) =>
                  patchItem(i, { icon: e.target.value || undefined })
                }
                placeholder="★"
                value={item.icon ?? ""}
              />
            </InspRow>
            <InspRow label="Title">
              <input
                onChange={(e) => patchItem(i, { title: e.target.value })}
                value={item.title}
              />
            </InspRow>
            <InspRow label="Body">
              <textarea
                onChange={(e) => patchItem(i, { body: e.target.value })}
                rows={2}
                value={item.body}
              />
            </InspRow>
            <InspRow label="Link">
              <input
                onChange={(e) =>
                  patchItem(i, { href: e.target.value || undefined })
                }
                placeholder="https://…"
                value={item.href ?? ""}
              />
            </InspRow>
          </div>
        ))}
        <button
          onClick={() =>
            onPatch("items", [
              ...block.items,
              { title: "New benefit", body: "Description." },
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
          + Add card
        </button>
      </InspSection>
    </>
  );
}
