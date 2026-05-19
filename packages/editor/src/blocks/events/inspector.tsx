"use client";

import { useState } from "react";
import type { EventsBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";
import { useEditorStore } from "@/editor/store";

interface Props { block: EventsBlock; onPatch: PatchFn; }

export function EventsInspector({ block, onPatch }: Props) {
  const department = useEditorStore((s) => s.doc.meta.department);
  const [mode, setMode] = useState<"auto" | "custom">(() =>
    block.source && block.source !== "auto" ? "custom" : "auto"
  );
  const [customId, setCustomId] = useState(
    block.source && block.source !== "auto" ? block.source : ""
  );

  const effectiveDept = block.source && block.source !== "auto" ? block.source : department;

  function handleModeChange(v: string) {
    if (v === "auto") {
      setMode("auto");
      onPatch("source", "auto");
    } else {
      setMode("custom");
    }
  }

  function commitCustomId() {
    const val = customId.trim();
    if (val && val !== "auto" && val !== "custom") {
      onPatch("source", val);
    }
  }

  return (
    <>
      <InspSection label="Events feed">
        <InspRow label="Heading">
          <input value={block.heading} onChange={(e) => onPatch("heading", e.target.value)} />
        </InspRow>
      </InspSection>
      <InspSection label="Data source">
        <InspRow label="Source">
          <select value={mode} onChange={(e) => handleModeChange(e.target.value)}>
            <option value="auto">Auto (page department)</option>
            <option value="custom">Custom department ID</option>
          </select>
        </InspRow>
        {mode === "custom" && (
          <InspRow label="Dept ID">
            <input
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              onBlur={commitCustomId}
              onKeyDown={(e) => e.key === "Enter" && commitCustomId()}
              placeholder="e.g. esn"
            />
          </InspRow>
        )}
        <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.45 }}>
          {effectiveDept
            ? <><span style={{ color: "var(--leaf)", fontWeight: 500 }}>● Live</span> — fetching events for <code style={{ fontFamily: "var(--mono)", fontSize: 10 }}>{effectiveDept}</code></>
            : <>Set a department on the Page tab to load live events.</>}
        </p>
      </InspSection>
    </>
  );
}
