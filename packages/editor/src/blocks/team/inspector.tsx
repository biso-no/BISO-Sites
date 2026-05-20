"use client";

import type { TeamBlock, TeamMember, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

const HUES: TeamMember["hue"][] = ["claret", "gold", "leaf", "sky"];
const HUE_COLORS: Record<TeamMember["hue"], string> = {
  claret: "#6b1e1e",
  gold:   "#b08a3e",
  leaf:   "#2f5d3a",
  sky:    "#2a4a7a",
};

function initials(name: string): string {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

interface Props { block: TeamBlock; doc: PageDoc; onPatch: PatchFn; }

export function TeamInspector({ block, onPatch }: Props) {
  function patchMember(i: number, patch: Partial<TeamMember>) {
    onPatch("members", block.members.map((m, j) => j === i ? { ...m, ...patch } : m));
  }

  return (
    <>
      <InspSection label="Team">
        <InspRow label="Heading">
          <input value={block.heading} onChange={(e) => onPatch("heading", e.target.value)} />
        </InspRow>
      </InspSection>
      <InspSection label={`Members (${block.members.length})`}>
        {block.members.map((m, i) => (
          <div key={i} style={{ padding: "10px 0", borderBottom: "0.5px solid var(--rule)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500 }}>{m.name || `Member ${i + 1}`}</span>
              <button
                type="button"
                onClick={() => onPatch("members", block.members.filter((_, j) => j !== i))}
                style={{ width: 18, height: 18, borderRadius: "50%", border: 0, background: "var(--rule-2)", cursor: "pointer", fontSize: 9, display: "grid", placeItems: "center" }}
                aria-label="Remove member"
              >✕</button>
            </div>
            <InspRow label="Name">
              <input value={m.name} onChange={(e) => {
                const name = e.target.value;
                patchMember(i, { name, initials: initials(name) });
              }} />
            </InspRow>
            <InspRow label="Role">
              <input value={m.role} onChange={(e) => patchMember(i, { role: e.target.value })} />
            </InspRow>
            <InspRow label="Initials">
              <input value={m.initials} maxLength={2} onChange={(e) => patchMember(i, { initials: e.target.value.toUpperCase() })} />
            </InspRow>
            <InspRow label="Color">
              <div style={{ display: "flex", gap: 6 }}>
                {HUES.map((h) => (
                  <button
                    key={h}
                    type="button"
                    title={h}
                    onClick={() => patchMember(i, { hue: h })}
                    style={{
                      width: 22, height: 22, borderRadius: "50%", border: m.hue === h ? "2px solid var(--ink)" : "2px solid transparent",
                      background: HUE_COLORS[h], cursor: "pointer", padding: 0,
                    }}
                    aria-pressed={m.hue === h}
                  />
                ))}
              </div>
            </InspRow>
          </div>
        ))}
        <button
          type="button"
          style={{ fontSize: 12, marginTop: 8, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
          onClick={() => onPatch("members", [...block.members, { name: "New Member", role: "Role", initials: "NM", hue: "claret" }])}
        >
          + Add member
        </button>
      </InspSection>
    </>
  );
}
