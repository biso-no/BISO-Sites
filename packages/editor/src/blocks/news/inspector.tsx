"use client";

import { useState } from "react";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { useEditorStore } from "@/editor/store";
import type { NewsBlock } from "@/editor/types";

interface Props {
  block: NewsBlock;
  onPatch: PatchFn;
}

export function NewsInspector({ block, onPatch }: Props) {
  const department = useEditorStore((s) => s.doc.meta.department);
  const [mode, setMode] = useState<"auto" | "custom">(() =>
    block.source && block.source !== "auto" ? "custom" : "auto"
  );
  const [customId, setCustomId] = useState(
    block.source && block.source !== "auto" ? block.source : ""
  );

  const effectiveDept =
    block.source && block.source !== "auto" ? block.source : department;

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
      <InspSection label="News feed">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Data source">
        <InspRow label="Source">
          <select
            onChange={(e) => handleModeChange(e.target.value)}
            value={mode}
          >
            <option value="auto">Auto (page department)</option>
            <option value="custom">Custom department ID</option>
          </select>
        </InspRow>
        {mode === "custom" && (
          <InspRow label="Dept ID">
            <input
              onBlur={commitCustomId}
              onChange={(e) => setCustomId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commitCustomId()}
              placeholder="e.g. esn"
              value={customId}
            />
          </InspRow>
        )}
        <p
          style={{
            fontSize: 11,
            color: "var(--ink-3)",
            marginTop: 4,
            lineHeight: 1.45,
          }}
        >
          {effectiveDept ? (
            <>
              <span style={{ color: "var(--leaf)", fontWeight: 500 }}>
                ● Live
              </span>{" "}
              — showing news for{" "}
              <code style={{ fontFamily: "var(--mono)", fontSize: 10 }}>
                {effectiveDept}
              </code>
            </>
          ) : (
            <>Set a department on the Page tab to load live news.</>
          )}
        </p>
      </InspSection>
    </>
  );
}
