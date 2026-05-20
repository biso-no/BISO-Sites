"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, StatsBlock } from "@/editor/types";

interface Props {
  block: StatsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function StatsInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Stats">
      {block.items.map((item, i) => (
        <div
          key={i}
          style={{
            marginBottom: 10,
            paddingBottom: 10,
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
              Stat {i + 1}
            </span>
            <button
              aria-label="Remove stat"
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
          <InspRow label="Number">
            <input
              onChange={(e) => {
                onPatch(
                  "items",
                  block.items.map((x, j) =>
                    j === i ? { ...x, num: e.target.value } : x
                  )
                );
              }}
              value={item.num}
            />
          </InspRow>
          <InspRow label="Label">
            <input
              onChange={(e) => {
                onPatch(
                  "items",
                  block.items.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x
                  )
                );
              }}
              value={item.label}
            />
          </InspRow>
        </div>
      ))}
      <button
        onClick={() =>
          onPatch("items", [...block.items, { num: "0", label: "New stat" }])
        }
        style={{
          fontSize: 12,
          padding: "4px 8px",
          border: "0.5px solid var(--rule-2)",
          borderRadius: 6,
          background: "var(--paper-2)",
          cursor: "pointer",
        }}
        type="button"
      >
        + Add stat
      </button>
    </InspSection>
  );
}
