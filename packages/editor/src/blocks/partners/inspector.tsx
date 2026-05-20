"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, PartnerItem, PartnersBlock } from "@/editor/types";

interface Props {
  block: PartnersBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function PartnersInspector({ block, onPatch }: Props) {
  const items = block.items ?? [];

  function patchItem(i: number, patch: Partial<PartnerItem>) {
    onPatch(
      "items",
      items.map((x, j) => (j === i ? { ...x, ...patch } : x))
    );
  }

  return (
    <>
      <InspSection label="Source">
        <div className="pe-variant-grid">
          {(["auto", "manual"] as const).map((v) => (
            <button
              className={`pe-variant${block.source === v ? "on" : ""}`}
              key={v}
              onClick={() => onPatch("source", v)}
              type="button"
            >
              <span className="v-name">{v === "auto" ? "Auto" : "Manual"}</span>
            </button>
          ))}
        </div>
        {block.source === "auto" && (
          <p style={{ fontSize: 11, color: "var(--leaf)", marginTop: 6 }}>
            ● Fetching from Appwrite partners collection
          </p>
        )}
      </InspSection>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            placeholder="Our partners"
            value={block.heading ?? ""}
          />
        </InspRow>
      </InspSection>
      {block.source === "manual" && (
        <InspSection label={`Partners (${items.length})`}>
          {items.map((p, i) => (
            <div
              key={i}
              style={{
                padding: "6px 0",
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
                  {p.name}
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
              <InspRow label="Name">
                <input
                  onChange={(e) => patchItem(i, { name: e.target.value })}
                  value={p.name}
                />
              </InspRow>
              <InspRow label="Logo URL">
                <input
                  onChange={(e) =>
                    patchItem(i, { logoSrc: e.target.value || undefined })
                  }
                  placeholder="https://…"
                  value={p.logoSrc ?? ""}
                />
              </InspRow>
              <InspRow label="Link">
                <input
                  onChange={(e) =>
                    patchItem(i, { href: e.target.value || undefined })
                  }
                  placeholder="https://…"
                  value={p.href ?? ""}
                />
              </InspRow>
            </div>
          ))}
          <button
            onClick={() =>
              onPatch("items", [...items, { name: "Partner name" }])
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
            + Add partner
          </button>
        </InspSection>
      )}
    </>
  );
}
