"use client";

import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import type {
  FormField,
  FormFieldType,
  FormStep,
  MultiStepFormBlock,
  PageDoc,
} from "@/editor/types";

interface Props {
  block: MultiStepFormBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
  { value: "hidden", label: "Hidden" },
];

export function MultiStepFormInspector({ block, onPatch }: Props) {
  const steps = block.steps ?? [];
  const mode = block.submitMode ?? "database";

  function patchStep(i: number, patch: Partial<FormStep>) {
    onPatch(
      "steps",
      steps.map((s, j) => (j === i ? { ...s, ...patch } : s))
    );
  }

  function patchField(si: number, fi: number, patch: Partial<FormField>) {
    onPatch(
      "steps",
      steps.map((s, i) => {
        if (i !== si) {
          return s;
        }
        return {
          ...s,
          fields: s.fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)),
        };
      })
    );
  }

  function removeField(si: number, fi: number) {
    onPatch(
      "steps",
      steps.map((s, i) =>
        i === si ? { ...s, fields: s.fields.filter((_, j) => j !== fi) } : s
      )
    );
  }

  function addField(si: number) {
    const newField: FormField = {
      name: `field_${Date.now()}`,
      label: "New field",
      fieldType: "text",
      required: false,
    };
    onPatch(
      "steps",
      steps.map((s, i) =>
        i === si ? { ...s, fields: [...s.fields, newField] } : s
      )
    );
  }

  return (
    <>
      <InspSection label="Form">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value || undefined)}
            placeholder="Get in touch"
            value={block.heading ?? ""}
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

        {mode === "email" && (
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
        )}

        {mode === "database" && (
          <>
            <InspRow label="Topic / ID">
              <input
                onChange={(e) =>
                  onPatch("submitTarget", {
                    ...block.submitTarget,
                    topic: e.target.value || undefined,
                  })
                }
                placeholder="e.g. whistleblowing, contact-form"
                value={block.submitTarget?.topic ?? ""}
              />
            </InspRow>
            <InspRow label="Admin label">
              <input
                onChange={(e) =>
                  onPatch("adminLabel", e.target.value || undefined)
                }
                placeholder="Display name in admin sidebar"
                value={block.adminLabel ?? ""}
              />
            </InspRow>
            <InspRow label="Restrict to team">
              <input
                onChange={(e) =>
                  onPatch("accessTeamId", e.target.value || undefined)
                }
                placeholder="Appwrite team ID (optional)"
                value={block.accessTeamId ?? ""}
              />
            </InspRow>
            <p
              style={{ fontSize: 11, color: "var(--ink-3)", margin: "4px 0 0" }}
            >
              If set, only members of that Appwrite team (+ global admins) can
              view submissions in the admin app.
            </p>
          </>
        )}
      </InspSection>

      {steps.map((step, si) => (
        <InspSection key={si} label={`Step ${si + 1}`}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <input
              onChange={(e) => patchStep(si, { title: e.target.value })}
              placeholder="Step title"
              style={{ flex: 1, marginRight: 6 }}
              value={step.title}
            />
            <button
              aria-label="Remove step"
              onClick={() =>
                onPatch(
                  "steps",
                  steps.filter((_, j) => j !== si)
                )
              }
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: 0,
                background: "var(--rule-2)",
                cursor: "pointer",
                fontSize: 10,
                display: "grid",
                placeItems: "center",
              }}
              type="button"
            >
              ✕
            </button>
          </div>

          {step.fields.map((field, fi) => (
            <div
              key={fi}
              style={{
                padding: "8px 0 8px 8px",
                borderLeft: "2px solid var(--rule)",
                marginBottom: 6,
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
                <span style={{ fontSize: 10, color: "var(--ink-3)" }}>
                  {field.label}
                </span>
                <button
                  aria-label="Remove field"
                  onClick={() => removeField(si, fi)}
                  style={{
                    width: 16,
                    height: 16,
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
              <InspRow label="Label">
                <input
                  onChange={(e) =>
                    patchField(si, fi, { label: e.target.value })
                  }
                  value={field.label}
                />
              </InspRow>
              <InspRow label="Name">
                <input
                  onChange={(e) =>
                    patchField(si, fi, {
                      name: e.target.value.toLowerCase().replace(/\s+/g, "_"),
                    })
                  }
                  placeholder="field_name"
                  value={field.name}
                />
              </InspRow>
              <InspRow label="Type">
                <select
                  onChange={(e) =>
                    patchField(si, fi, {
                      fieldType: e.target.value as FormFieldType,
                    })
                  }
                  value={field.fieldType}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </InspRow>
              <InspRow label="Placeholder">
                <input
                  onChange={(e) =>
                    patchField(si, fi, {
                      placeholder: e.target.value || undefined,
                    })
                  }
                  value={field.placeholder ?? ""}
                />
              </InspRow>
              <InspRow label="Required">
                <input
                  checked={field.required ?? false}
                  onChange={(e) =>
                    patchField(si, fi, { required: e.target.checked })
                  }
                  type="checkbox"
                />
              </InspRow>
            </div>
          ))}

          <button
            onClick={() => addField(si)}
            style={{
              fontSize: 11,
              padding: "3px 8px",
              border: "0.5px solid var(--rule-2)",
              borderRadius: 5,
              background: "var(--paper-2)",
              cursor: "pointer",
              marginTop: 2,
            }}
            type="button"
          >
            + Add field
          </button>
        </InspSection>
      ))}

      <div style={{ padding: "0 12px 12px" }}>
        <button
          onClick={() =>
            onPatch("steps", [
              ...steps,
              { title: `Step ${steps.length + 1}`, fields: [] },
            ])
          }
          style={{
            fontSize: 12,
            width: "100%",
            padding: "6px 0",
            border: "0.5px dashed var(--rule-2)",
            borderRadius: 6,
            background: "transparent",
            cursor: "pointer",
          }}
          type="button"
        >
          + Add step
        </button>
      </div>
    </>
  );
}
