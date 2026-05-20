"use client";

import type { PartnerItem, PartnersBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: PartnersBlock; doc: PageDoc; onPatch: PatchFn; }

export function PartnersInspector({ block, onPatch }: Props) {
  const items = block.items ?? [];

  function patchItem(i: number, patch: Partial<PartnerItem>) {
    onPatch("items", items.map((x, j) => j === i ? { ...x, ...patch } : x));
  }

  return (
    <>
      <InspSection label="Source">
        <div className="pe-variant-grid">
          {(["auto", "manual"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`pe-variant${block.source === v ? " on" : ""}`}
              onClick={() => onPatch("source", v)}
            >
              <span className="v-name">{v === "auto" ? "Auto" : "Manual"}</span>
            </button>
          ))}
        </div>
        {block.source === "auto" && (
          <p style={{ fontSize: 11, color: "var(--leaf)", marginTop: 6 }}>● Fetching from Appwrite partners collection</p>
        )}
      </InspSection>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input value={block.heading ?? ""} onChange={(e) => onPatch("heading", e.target.value)} placeholder="Our partners" />
        </InspRow>
      </InspSection>
      {block.source === "manual" && (
        <InspSection label={`Partners (${items.length})`}>
          {items.map((p, i) => (
            <div key={i} style={{ padding: "6px 0", borderBottom: "0.5px solid var(--rule)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{p.name}</span>
                <button
                  type="button"
                  onClick={() => onPatch("items", items.filter((_, j) => j !== i))}
                  style={{ width: 18, height: 18, borderRadius: "50%", border: 0, background: "var(--rule-2)", cursor: "pointer", fontSize: 9, display: "grid", placeItems: "center" }}
                  aria-label="Remove"
                >✕</button>
              </div>
              <InspRow label="Name"><input value={p.name} onChange={(e) => patchItem(i, { name: e.target.value })} /></InspRow>
              <InspRow label="Logo URL"><input value={p.logoSrc ?? ""} onChange={(e) => patchItem(i, { logoSrc: e.target.value || undefined })} placeholder="https://…" /></InspRow>
              <InspRow label="Link"><input value={p.href ?? ""} onChange={(e) => patchItem(i, { href: e.target.value || undefined })} placeholder="https://…" /></InspRow>
            </div>
          ))}
          <button
            type="button"
            style={{ fontSize: 12, marginTop: 8, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
            onClick={() => onPatch("items", [...items, { name: "Partner name" }])}
          >+ Add partner</button>
        </InspSection>
      )}
    </>
  );
}
