"use client";

import type { ContactBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: ContactBlock; doc: PageDoc; onPatch: PatchFn; }

export function ContactInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["single", "directory"] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={`pe-variant${(block.variant ?? "single") === v ? " on" : ""}`}
              onClick={() => onPatch("variant", v)}
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Contact">
        <InspRow label="Heading">
          <input value={block.heading} onChange={(e) => onPatch("heading", e.target.value)} />
        </InspRow>
        <InspRow label="Email">
          <input type="email" value={block.email} onChange={(e) => onPatch("email", e.target.value)} />
        </InspRow>
        <InspRow label="Instagram">
          <input value={block.instagram} onChange={(e) => onPatch("instagram", e.target.value)} />
        </InspRow>
        <InspRow label="Address">
          <input value={block.address} onChange={(e) => onPatch("address", e.target.value)} />
        </InspRow>
        <InspRow label="Hours">
          <input value={block.hours} onChange={(e) => onPatch("hours", e.target.value)} />
        </InspRow>
      </InspSection>
      {(block.variant ?? "single") === "directory" && (
        <InspSection label={`Directory (${(block.members ?? []).length})`}>
          {(block.members ?? []).map((m, i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: "0.5px solid var(--rule)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{m.name}</span>
                <button
                  type="button"
                  onClick={() => onPatch("members", (block.members ?? []).filter((_, j) => j !== i))}
                  style={{ width: 18, height: 18, borderRadius: "50%", border: 0, background: "var(--rule-2)", cursor: "pointer", fontSize: 9, display: "grid", placeItems: "center" }}
                  aria-label="Remove"
                >✕</button>
              </div>
              <InspRow label="Name"><input value={m.name} onChange={(e) => {
                const members = (block.members ?? []).map((x, j) => j === i ? { ...x, name: e.target.value } : x);
                onPatch("members", members);
              }} /></InspRow>
              <InspRow label="Role"><input value={m.role} onChange={(e) => {
                const members = (block.members ?? []).map((x, j) => j === i ? { ...x, role: e.target.value } : x);
                onPatch("members", members);
              }} /></InspRow>
              <InspRow label="Email"><input type="email" value={m.email ?? ""} onChange={(e) => {
                const members = (block.members ?? []).map((x, j) => j === i ? { ...x, email: e.target.value } : x);
                onPatch("members", members);
              }} /></InspRow>
              <InspRow label="Phone"><input value={m.phone ?? ""} onChange={(e) => {
                const members = (block.members ?? []).map((x, j) => j === i ? { ...x, phone: e.target.value } : x);
                onPatch("members", members);
              }} /></InspRow>
            </div>
          ))}
          <button
            type="button"
            style={{ fontSize: 12, marginTop: 8, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
            onClick={() => onPatch("members", [...(block.members ?? []), { name: "Name", role: "Role", email: "" }])}
          >+ Add person</button>
        </InspSection>
      )}
    </>
  );
}
