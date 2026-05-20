"use client";

import type { PatchFn } from "@/blocks/types";
import { InspSection } from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, TextBlock, TextBodyItem } from "@/editor/types";

const TYPE_LABELS: Record<TextBodyItem["type"], string> = {
  h: "H2",
  h3: "H3",
  p: "Paragraph",
  li: "List item",
};

interface Props {
  block: TextBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function TextInspector({ block, onPatch }: Props) {
  return (
    <InspSection label="Content blocks">
      {block.body.map((item, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 0",
            borderBottom: "0.5px solid var(--rule)",
          }}
        >
          <select
            onChange={(e) => {
              const body = block.body.map((x, j) =>
                j === i
                  ? { ...x, type: e.target.value as TextBodyItem["type"] }
                  : x
              );
              onPatch("body", body);
            }}
            style={{
              fontSize: 11,
              padding: "2px 4px",
              border: "0.5px solid var(--rule-2)",
              borderRadius: 4,
              background: "var(--paper-2)",
              color: "var(--ink)",
              flex: "0 0 auto",
            }}
            value={item.type}
          >
            {(["h", "h3", "p", "li"] as const).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <span
            style={{
              flex: 1,
              fontSize: 12,
              color: "var(--ink-2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.text || "(empty)"}
          </span>
          <button
            aria-label="Remove item"
            onClick={() =>
              onPatch(
                "body",
                block.body.filter((_, j) => j !== i)
              )
            }
            style={{
              flexShrink: 0,
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
      ))}
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {(["h", "h3", "p", "li"] as const).map((t) => (
          <button
            key={t}
            onClick={() =>
              onPatch("body", [
                ...block.body,
                { type: t, text: TYPE_LABELS[t] },
              ])
            }
            style={{
              flex: 1,
              fontSize: 10.5,
              padding: "4px 2px",
              border: "0.5px solid var(--rule-2)",
              borderRadius: 5,
              background: "var(--paper-2)",
              cursor: "pointer",
              color: "var(--ink-2)",
            }}
            type="button"
          >
            +{TYPE_LABELS[t]}
          </button>
        ))}
      </div>
    </InspSection>
  );
}
