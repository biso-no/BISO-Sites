"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, TeamBlock, TeamMember } from "@/editor/types";
import { HUE_COLORS } from "@/theme/presets";

const HUES = Object.keys(HUE_COLORS) as TeamMember["hue"][];

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface Props {
  block: TeamBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function TeamInspector({ block, onPatch }: Props) {
  function patchMember(i: number, patch: Partial<TeamMember>) {
    onPatch(
      "members",
      block.members.map((m, j) => (j === i ? { ...m, ...patch } : m))
    );
  }

  return (
    <>
      <InspSection label="Team">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading}
          />
        </InspRow>
      </InspSection>
      <InspSection label={`Members (${block.members.length})`}>
        {block.members.map((m, i) => (
          <div
            key={i}
            style={{
              padding: "10px 0",
              borderBottom: "0.5px solid var(--rule)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span
                style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500 }}
              >
                {m.name || `Member ${i + 1}`}
              </span>
              <button
                aria-label="Remove member"
                onClick={() =>
                  onPatch(
                    "members",
                    block.members.filter((_, j) => j !== i)
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
                onChange={(e) => {
                  const name = e.target.value;
                  patchMember(i, { name, initials: initials(name) });
                }}
                value={m.name}
              />
            </InspRow>
            <InspRow label="Role">
              <input
                onChange={(e) => patchMember(i, { role: e.target.value })}
                value={m.role}
              />
            </InspRow>
            <InspRow label="Initials">
              <input
                maxLength={2}
                onChange={(e) =>
                  patchMember(i, { initials: e.target.value.toUpperCase() })
                }
                value={m.initials}
              />
            </InspRow>
            <InspRow label="Color">
              <div style={{ display: "flex", gap: 6 }}>
                {HUES.map((h) => (
                  <button
                    aria-pressed={m.hue === h}
                    key={h}
                    onClick={() => patchMember(i, { hue: h })}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border:
                        m.hue === h
                          ? "2px solid var(--ink)"
                          : "2px solid transparent",
                      background: HUE_COLORS[h],
                      cursor: "pointer",
                      padding: 0,
                    }}
                    title={h}
                    type="button"
                  />
                ))}
              </div>
            </InspRow>
          </div>
        ))}
        <button
          onClick={() =>
            onPatch("members", [
              ...block.members,
              {
                name: "New Member",
                role: "Role",
                initials: "NM",
                hue: "blue",
              },
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
          + Add member
        </button>
      </InspSection>
    </>
  );
}
