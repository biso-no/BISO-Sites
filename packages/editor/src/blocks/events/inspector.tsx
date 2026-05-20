"use client";

import { useEffect, useState } from "react";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { useEditorStore } from "@/editor/store";
import type { EventsBlock, PageDoc } from "@/editor/types";

interface Props {
  block: EventsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

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
    if (!isAuto) {
      setCustomId(block.source);
    }
  }, [block.source]);

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
      <InspSection label="Events feed">
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
              — fetching events for{" "}
              <code style={{ fontFamily: "var(--mono)", fontSize: 10 }}>
                {effectiveDept}
              </code>
            </>
          ) : (
            <>Set a department on the Page tab to load live events.</>
          )}
        </p>
      </InspSection>
      {!effectiveDept && (
        <InspSection label="Placeholder events">
          <p
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              lineHeight: 1.45,
              marginBottom: 8,
            }}
          >
            Shown when no department is set. Set a department above to use live
            data instead.
          </p>
          {block.items.map((item, i) => (
            <div
              key={i}
              style={{
                padding: "6px 0",
                borderBottom: "0.5px solid var(--rule)",
              }}
            >
              <InspRow label="Title">
                <input
                  onChange={(e) => {
                    onPatch(
                      "items",
                      block.items.map((x, j) =>
                        j === i ? { ...x, title: e.target.value } : x
                      )
                    );
                  }}
                  value={item.title}
                />
              </InspRow>
              <InspRow label="Date">
                <input
                  onChange={(e) => {
                    onPatch(
                      "items",
                      block.items.map((x, j) =>
                        j === i ? { ...x, date: e.target.value } : x
                      )
                    );
                  }}
                  value={item.date}
                />
              </InspRow>
              <InspRow label="Where">
                <input
                  onChange={(e) => {
                    onPatch(
                      "items",
                      block.items.map((x, j) =>
                        j === i ? { ...x, where: e.target.value } : x
                      )
                    );
                  }}
                  value={item.where}
                />
              </InspRow>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 4,
                }}
              >
                <button
                  onClick={() =>
                    onPatch(
                      "items",
                      block.items.filter((_, j) => j !== i)
                    )
                  }
                  style={{
                    fontSize: 10,
                    padding: "2px 6px",
                    border: "0.5px solid var(--rule-2)",
                    borderRadius: 4,
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--ink-3)",
                  }}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              onPatch("items", [
                ...block.items,
                { date: "Soon", title: "Event", where: "Location", going: 0 },
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
            + Add event
          </button>
        </InspSection>
      )}
    </>
  );
}
