"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type { ContactBlock, PageDoc } from "@/editor/types";

interface Props {
  block: ContactBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

export function ContactInspector({ block, onPatch }: Props) {
  return (
    <>
      <InspSection label="Layout">
        <div className="pe-variant-grid">
          {(["single", "directory"] as const).map((v) => (
            <button
              className={`pe-variant${(block.variant ?? "single") === v ? "on" : ""}`}
              key={v}
              onClick={() => onPatch("variant", v)}
              type="button"
            >
              <span className="v-name">{v}</span>
            </button>
          ))}
        </div>
      </InspSection>
      <InspSection label="Contact">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading}
          />
        </InspRow>
        <InspRow label="Email">
          <input
            onChange={(e) => onPatch("email", e.target.value)}
            type="email"
            value={block.email}
          />
        </InspRow>
        <InspRow label="Instagram">
          <input
            onChange={(e) => onPatch("instagram", e.target.value)}
            value={block.instagram}
          />
        </InspRow>
        <InspRow label="Address">
          <input
            onChange={(e) => onPatch("address", e.target.value)}
            value={block.address}
          />
        </InspRow>
        <InspRow label="Hours">
          <input
            onChange={(e) => onPatch("hours", e.target.value)}
            value={block.hours}
          />
        </InspRow>
      </InspSection>
      {(block.variant ?? "single") === "directory" && (
        <InspSection label={`Directory (${(block.members ?? []).length})`}>
          {(block.members ?? []).map((m, i) => (
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
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  {m.name}
                </span>
                <button
                  aria-label="Remove"
                  onClick={() =>
                    onPatch(
                      "members",
                      (block.members ?? []).filter((_, j) => j !== i)
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
                    const members = (block.members ?? []).map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x
                    );
                    onPatch("members", members);
                  }}
                  value={m.name}
                />
              </InspRow>
              <InspRow label="Role">
                <input
                  onChange={(e) => {
                    const members = (block.members ?? []).map((x, j) =>
                      j === i ? { ...x, role: e.target.value } : x
                    );
                    onPatch("members", members);
                  }}
                  value={m.role}
                />
              </InspRow>
              <InspRow label="Email">
                <input
                  onChange={(e) => {
                    const members = (block.members ?? []).map((x, j) =>
                      j === i ? { ...x, email: e.target.value } : x
                    );
                    onPatch("members", members);
                  }}
                  type="email"
                  value={m.email ?? ""}
                />
              </InspRow>
              <InspRow label="Phone">
                <input
                  onChange={(e) => {
                    const members = (block.members ?? []).map((x, j) =>
                      j === i ? { ...x, phone: e.target.value } : x
                    );
                    onPatch("members", members);
                  }}
                  value={m.phone ?? ""}
                />
              </InspRow>
            </div>
          ))}
          <button
            onClick={() =>
              onPatch("members", [
                ...(block.members ?? []),
                { name: "Name", role: "Role", email: "" },
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
            + Add person
          </button>
        </InspSection>
      )}
    </>
  );
}
