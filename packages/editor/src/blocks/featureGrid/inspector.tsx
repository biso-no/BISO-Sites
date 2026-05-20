"use client";

import type { FeatureGridBlock, FeatureGridItem, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: FeatureGridBlock; doc: PageDoc; onPatch: PatchFn; }

export function FeatureGridInspector({ block, onPatch }: Props) {
  const variant = block.variant ?? "cards";
  const cols = block.columns ?? 3;

  function patchItem(i: number, patch: Partial<FeatureGridItem>) {
    onPatch("items", block.items.map((x, j) => j === i ? { ...x, ...patch } : x));
  }

  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["bordered", "cards", "minimal"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`pe-variant${variant === v ? " on" : ""}`}
              onClick={() => onPatch("variant", v)}
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
        <InspRow label="Columns">
          <select value={cols} onChange={(e) => onPatch("columns", Number(e.target.value) as 2|3|4)}>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </InspRow>
      </InspSection>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input value={block.heading ?? ""} onChange={(e) => onPatch("heading", e.target.value)} placeholder="Optional heading" />
        </InspRow>
        <InspRow label="Intro">
          <textarea value={block.intro ?? ""} rows={2} onChange={(e) => onPatch("intro", e.target.value)} placeholder="Optional intro text" />
        </InspRow>
      </InspSection>
      <InspSection label={`Items (${block.items.length})`}>
        {block.items.map((item, i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: "0.5px solid var(--rule)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{item.title || `Item ${i + 1}`}</span>
              <button
                type="button"
                onClick={() => onPatch("items", block.items.filter((_, j) => j !== i))}
                style={{ width: 18, height: 18, borderRadius: "50%", border: 0, background: "var(--rule-2)", cursor: "pointer", fontSize: 9, display: "grid", placeItems: "center" }}
                aria-label="Remove"
              >✕</button>
            </div>
            <InspRow label="Icon"><input value={item.icon} onChange={(e) => patchItem(i, { icon: e.target.value })} placeholder="★" /></InspRow>
            <InspRow label="Title"><input value={item.title} onChange={(e) => patchItem(i, { title: e.target.value })} /></InspRow>
            <InspRow label="Body"><textarea value={item.body} rows={2} onChange={(e) => patchItem(i, { body: e.target.value })} /></InspRow>
            <InspRow label="Link"><input value={item.href ?? ""} onChange={(e) => patchItem(i, { href: e.target.value || undefined })} placeholder="https://…" /></InspRow>
          </div>
        ))}
        <button
          type="button"
          style={{ fontSize: 12, marginTop: 8, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
          onClick={() => onPatch("items", [...block.items, { icon: "★", title: "New feature", body: "Description." }])}
        >+ Add item</button>
      </InspSection>
    </>
  );
}
