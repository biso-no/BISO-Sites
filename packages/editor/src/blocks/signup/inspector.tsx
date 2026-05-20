"use client";

import type { SignupBlock, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: SignupBlock; doc: PageDoc; onPatch: PatchFn; }

export function SignupInspector({ block, onPatch }: Props) {
  const mode = block.submitMode ?? "database";

  return (
    <>
      <InspSection label="Content">
        <InspRow label="Heading">
          <input value={block.heading} onChange={(e) => onPatch("heading", e.target.value)} />
        </InspRow>
        <InspRow label="Placeholder">
          <input value={block.placeholder ?? ""} onChange={(e) => onPatch("placeholder", e.target.value)} placeholder="you@bi.no" />
        </InspRow>
      </InspSection>
      <InspSection label="Submission">
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(["database", "email"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onPatch("submitMode", m)}
              style={{
                flex: 1, padding: "6px 0", borderRadius: 8, border: "0.5px solid var(--rule-2)",
                background: mode === m ? "var(--ink)" : "var(--paper-2)",
                color: mode === m ? "var(--paper)" : "var(--ink-2)",
                cursor: "pointer", fontSize: 12, fontFamily: "inherit",
              }}
            >
              {m === "database" ? "💾 Save to DB" : "📧 Email"}
            </button>
          ))}
        </div>
        {mode === "email" ? (
          <InspRow label="Recipient">
            <input
              value={block.recipientEmail ?? ""}
              onChange={(e) => onPatch("recipientEmail", e.target.value || undefined)}
              placeholder="admin@biso.no"
              type="email"
            />
          </InspRow>
        ) : (
          <InspRow label="Topic">
            <input
              value={block.topic ?? ""}
              onChange={(e) => onPatch("topic", e.target.value || undefined)}
              placeholder="signup (default)"
            />
          </InspRow>
        )}
      </InspSection>
    </>
  );
}
