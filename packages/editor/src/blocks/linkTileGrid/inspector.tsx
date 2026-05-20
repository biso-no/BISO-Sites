"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { LinkTileGridBlock, LinkTileItem, PageDoc } from "@/editor/types";

interface Props {
  block: LinkTileGridBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function LinkTileGridInspector({ block, onPatch }: Props) {
  function patchItem(i: number, patch: Partial<LinkTileItem>) {
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
            placeholder="Optional heading"
            value={block.heading ?? ""}
          />
        </InspRow>
      </InspSection>
      <InspSection label={`Tiles (${block.items.length})`}>
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
                onChange={(e) => patchItem(i, { icon: e.target.value })}
                placeholder="→"
                value={item.icon}
              />
            </InspRow>
            <InspRow label="Title">
              <input
                onChange={(e) => patchItem(i, { title: e.target.value })}
                value={item.title}
              />
            </InspRow>
            <InspRow label="Description">
              <input
                onChange={(e) =>
                  patchItem(i, { description: e.target.value || undefined })
                }
                value={item.description ?? ""}
              />
            </InspRow>
            <InspRow label="URL">
              <input
                onChange={(e) => patchItem(i, { href: e.target.value })}
                placeholder="https://…"
                value={item.href}
              />
            </InspRow>
          </div>
        ))}
        <button
          onClick={() =>
            onPatch("items", [
              ...block.items,
              { icon: "→", title: "New page", href: "#" },
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
          + Add tile
        </button>
      </InspSection>
    </>
  );
}
