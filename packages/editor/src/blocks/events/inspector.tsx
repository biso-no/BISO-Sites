"use client";

import { useEffect, useState } from "react";
import type { EventsBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";
import { useEditorStore } from "@/editor/store";

interface Props { block: EventsBlock; doc: PageDoc; onPatch: PatchFn; }

export function EventsInspector({ block, onPatch }: Props) {
  const department = useEditorStore((s) => s.doc.meta.department);
  const [mode, setMode] = useState<"auto" | "custom">(() =>
    block.source && block.source !== "auto" ? "custom" : "auto"
  );
  const [customId, setCustomId] = useState(
    block.source && block.source !== "auto" ? block.source : ""
  );

  useEffect(() => {
    const isAuto = !block.source || block.source === "auto";
    setMode(isAuto ? "auto" : "custom");
    if (!isAuto) setCustomId(block.source);
  }, [block.source]);

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
      {!effectiveDept && (
        <InspSection label="Placeholder events">
          <p style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.45, marginBottom: 8 }}>
            Shown when no department is set. Set a department above to use live data instead.
          </p>
          {block.items.map((item, i) => (
            <div key={i} style={{ padding: "6px 0", borderBottom: "0.5px solid var(--rule)" }}>
              <InspRow label="Title">
                <input value={item.title} onChange={(e) => {
                  onPatch("items", block.items.map((x, j) => j === i ? { ...x, title: e.target.value } : x));
                }} />
              </InspRow>
              <InspRow label="Date">
                <input value={item.date} onChange={(e) => {
                  onPatch("items", block.items.map((x, j) => j === i ? { ...x, date: e.target.value } : x));
                }} />
              </InspRow>
              <InspRow label="Where">
                <input value={item.where} onChange={(e) => {
                  onPatch("items", block.items.map((x, j) => j === i ? { ...x, where: e.target.value } : x));
                }} />
              </InspRow>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => onPatch("items", block.items.filter((_, j) => j !== i))}
                  style={{ fontSize: 10, padding: "2px 6px", border: "0.5px solid var(--rule-2)", borderRadius: 4, background: "transparent", cursor: "pointer", color: "var(--ink-3)" }}
                >Remove</button>
              </div>
            </div>
          ))}
          <button
            type="button"
            style={{ fontSize: 12, marginTop: 8, padding: "4px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 6, background: "var(--paper-2)", cursor: "pointer" }}
            onClick={() => onPatch("items", [...block.items, { date: "Soon", title: "Event", where: "Location", going: 0 }])}
          >+ Add event</button>
        </InspSection>
      )}
    </>
  );
}
