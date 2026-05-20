"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { FaqBlock, PageDoc } from "@/editor/types";

interface Props {
  block: FaqBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function FaqInspector({ block, onPatch }: Props) {
  const variant = block.variant ?? "list";
  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["list", "accordion-themed"] as const).map((v) => (
            <button
              className={`pe-variant${variant === v ? "on" : ""}`}
              key={v}
              onClick={() => onPatch("variant", v)}
              type="button"
            >
              <span className="v-name">{v === "list" ? "List" : "Themed"}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="FAQ">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading}
          />
        </InspRow>
        <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 6 }}>
          {block.items.length} question{block.items.length === 1 ? "" : "s"}.
        </p>
        {block.items.map((item, i) => (
          <div
            key={i}
            style={{
              padding: "6px 0",
              borderBottom: "0.5px solid var(--rule)",
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
            }}
          >
            <div style={{ flex: 1 }}>
              <InspRow label="Q">
                <input
                  onChange={(e) => {
                    onPatch(
                      "items",
                      block.items.map((x, j) =>
                        j === i ? { ...x, q: e.target.value } : x
                      )
                    );
                  }}
                  value={item.q}
                />
              </InspRow>
              <InspRow label="A">
                <textarea
                  onChange={(e) => {
                    onPatch(
                      "items",
                      block.items.map((x, j) =>
                        j === i ? { ...x, a: e.target.value } : x
                      )
                    );
                  }}
                  rows={2}
                  value={item.a}
                />
              </InspRow>
            </div>
            <button
              aria-label="Remove question"
              onClick={() =>
                onPatch(
                  "items",
                  block.items.filter((_, j) => j !== i)
                )
              }
              style={{
                flexShrink: 0,
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: 0,
                background: "var(--rule-2)",
                cursor: "pointer",
                fontSize: 9,
                display: "grid",
                placeItems: "center",
                marginTop: 4,
              }}
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            onPatch("items", [
              ...block.items,
              { q: "New question?", a: "Answer." },
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
          + Add question
        </button>
      </InspSection>
    </>
  );
}
