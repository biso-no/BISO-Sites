"use client";

import type { PatchFn } from "@/blocks/types";
import { InspSection } from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, TabItem, TabsBlock } from "@/editor/types";

interface Props {
  block: TabsBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function TabsInspector({ block, onPatch }: Props) {
  const variant = block.variant ?? "underline";
  const tabs = block.tabs ?? [];

  function patchTab(i: number, patch: Partial<TabItem>) {
    onPatch(
      "tabs",
      tabs.map((x, j) => (j === i ? { ...x, ...patch } : x))
    );
  }

  return (
    <>
      <InspSection label="Style">
        <div className="pe-variant-grid">
          {(["pills", "underline", "cards"] as const).map((v) => (
            <button
              className={`pe-variant${variant === v ? "on" : ""}`}
              key={v}
              onClick={() => onPatch("variant", v)}
              type="button"
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label={`Tabs (${tabs.length})`}>
        {tabs.map((tab, i) => (
          <div
            key={i}
            style={{
              padding: "8px 0",
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
              <span
                style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 500 }}
              >
                {tab.label}
              </span>
              <button
                aria-label="Remove tab"
                onClick={() =>
                  onPatch(
                    "tabs",
                    tabs.filter((_, j) => j !== i)
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
            <div style={{ marginBottom: 4 }}>
              <label
                htmlFor={`tab-label-${i}`}
                style={{
                  fontSize: 11,
                  color: "var(--ink-3)",
                  display: "block",
                  marginBottom: 2,
                }}
              >
                Label
              </label>
              <input
                id={`tab-label-${i}`}
                onChange={(e) => patchTab(i, { label: e.target.value })}
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "4px 8px",
                  border: "0.5px solid var(--rule-2)",
                  borderRadius: 4,
                  background: "var(--paper-2)",
                  color: "var(--ink)",
                }}
                value={tab.label}
              />
            </div>
            <div>
              <label
                htmlFor={`tab-body-${i}`}
                style={{
                  fontSize: 11,
                  color: "var(--ink-3)",
                  display: "block",
                  marginBottom: 2,
                }}
              >
                Content
              </label>
              <textarea
                id={`tab-body-${i}`}
                onChange={(e) => patchTab(i, { body: e.target.value })}
                rows={3}
                style={{
                  width: "100%",
                  fontSize: 12,
                  padding: "4px 8px",
                  border: "0.5px solid var(--rule-2)",
                  borderRadius: 4,
                  background: "var(--paper-2)",
                  color: "var(--ink)",
                  resize: "vertical",
                }}
                value={tab.body}
              />
            </div>
          </div>
        ))}
        <button
          onClick={() =>
            onPatch("tabs", [
              ...tabs,
              { label: "New tab", body: "Tab content." },
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
          + Add tab
        </button>
      </InspSection>
    </>
  );
}
