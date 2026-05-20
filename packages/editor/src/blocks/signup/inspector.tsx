"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { PageDoc, SignupBlock } from "@/editor/types";

interface Props {
  block: SignupBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function SignupInspector({ block, onPatch }: Props) {
  const mode = block.submitMode ?? "database";

  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading}
          />
        </InspRow>
        <InspRow label="Placeholder">
          <input
            onChange={(e) => onPatch("placeholder", e.target.value)}
            placeholder="you@bi.no"
            value={block.placeholder ?? ""}
          />
        </InspRow>
      </InspSection>
      <InspSection label="Submission">
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(["database", "email"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onPatch("submitMode", m)}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 8,
                border: "0.5px solid var(--rule-2)",
                background: mode === m ? "var(--ink)" : "var(--paper-2)",
                color: mode === m ? "var(--paper)" : "var(--ink-2)",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
              }}
              type="button"
            >
              {m === "database" ? "💾 Save to DB" : "📧 Email"}
            </button>
          ))}
        </div>
        {mode === "email" ? (
          <InspRow label="Recipient">
            <input
              onChange={(e) =>
                onPatch("recipientEmail", e.target.value || undefined)
              }
              placeholder="admin@biso.no"
              type="email"
              value={block.recipientEmail ?? ""}
            />
          </InspRow>
        ) : (
          <InspRow label="Topic">
            <input
              onChange={(e) => onPatch("topic", e.target.value || undefined)}
              placeholder="signup (default)"
              value={block.topic ?? ""}
            />
          </InspRow>
        )}
      </InspSection>
    </>
  );
}
