"use client";

import type { MultiStepFormBlock, FormStep, FormField, FormFieldType, PageDoc } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";
import { InspRow, InspSection } from "@/components/editor-shell/inspector/insp-parts";

interface Props { block: MultiStepFormBlock; doc: PageDoc; onPatch: PatchFn; }

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
    onPatch("steps", steps.map((s, j) => j === i ? { ...s, ...patch } : s));
  }

  function patchField(si: number, fi: number, patch: Partial<FormField>) {
    onPatch("steps", steps.map((s, i) => {
      if (i !== si) return s;
      return { ...s, fields: s.fields.map((f, j) => j === fi ? { ...f, ...patch } : f) };
    }));
  }

  function removeField(si: number, fi: number) {
    onPatch("steps", steps.map((s, i) => i !== si ? s : { ...s, fields: s.fields.filter((_, j) => j !== fi) }));
  }

  function addField(si: number) {
    const newField: FormField = { name: `field_${Date.now()}`, label: "New field", fieldType: "text", required: false };
    onPatch("steps", steps.map((s, i) => i === si ? { ...s, fields: [...s.fields, newField] } : s));
  }

  return (
    <>
      <InspSection label="Form">
        <InspRow label="Heading">
          <input value={block.heading ?? ""} onChange={(e) => onPatch("heading", e.target.value || undefined)} placeholder="Get in touch" />
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

        {mode === "email" && (
          <InspRow label="Recipient">
            <input
              value={block.recipientEmail ?? ""}
              onChange={(e) => onPatch("recipientEmail", e.target.value || undefined)}
              placeholder="admin@biso.no"
              type="email"
            />
          </InspRow>
        )}

        {mode === "database" && (
          <>
            <InspRow label="Topic / ID">
              <input
                value={block.submitTarget?.topic ?? ""}
                onChange={(e) => onPatch("submitTarget", { ...block.submitTarget, topic: e.target.value || undefined })}
                placeholder="e.g. whistleblowing, contact-form"
              />
            </InspRow>
            <InspRow label="Admin label">
              <input
                value={block.adminLabel ?? ""}
                onChange={(e) => onPatch("adminLabel", e.target.value || undefined)}
                placeholder="Display name in admin sidebar"
              />
            </InspRow>
            <InspRow label="Restrict to team">
              <input
                value={block.accessTeamId ?? ""}
                onChange={(e) => onPatch("accessTeamId", e.target.value || undefined)}
                placeholder="Appwrite team ID (optional)"
              />
            </InspRow>
            <p style={{ fontSize: 11, color: "var(--ink-3)", margin: "4px 0 0" }}>
              If set, only members of that Appwrite team (+ global admins) can view submissions in the admin app.
            </p>
          </>
        )}
      </InspSection>

      {steps.map((step, si) => (
        <InspSection key={si} label={`Step ${si + 1}`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <input
              value={step.title}
              onChange={(e) => patchStep(si, { title: e.target.value })}
              style={{ flex: 1, marginRight: 6 }}
              placeholder="Step title"
            />
            <button
              type="button"
              onClick={() => onPatch("steps", steps.filter((_, j) => j !== si))}
              style={{ width: 20, height: 20, borderRadius: "50%", border: 0, background: "var(--rule-2)", cursor: "pointer", fontSize: 10, display: "grid", placeItems: "center" }}
              aria-label="Remove step"
            >✕</button>
          </div>

          {step.fields.map((field, fi) => (
            <div key={fi} style={{ padding: "8px 0 8px 8px", borderLeft: "2px solid var(--rule)", marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "var(--ink-3)" }}>{field.label}</span>
                <button
                  type="button"
                  onClick={() => removeField(si, fi)}
                  style={{ width: 16, height: 16, borderRadius: "50%", border: 0, background: "var(--rule-2)", cursor: "pointer", fontSize: 9, display: "grid", placeItems: "center" }}
                  aria-label="Remove field"
                >✕</button>
              </div>
              <InspRow label="Label">
                <input value={field.label} onChange={(e) => patchField(si, fi, { label: e.target.value })} />
              </InspRow>
              <InspRow label="Name">
                <input
                  value={field.name}
                  onChange={(e) => patchField(si, fi, { name: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                  placeholder="field_name"
                />
              </InspRow>
              <InspRow label="Type">
                <select value={field.fieldType} onChange={(e) => patchField(si, fi, { fieldType: e.target.value as FormFieldType })}>
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </InspRow>
              <InspRow label="Placeholder">
                <input value={field.placeholder ?? ""} onChange={(e) => patchField(si, fi, { placeholder: e.target.value || undefined })} />
              </InspRow>
              <InspRow label="Required">
                <input type="checkbox" checked={field.required ?? false} onChange={(e) => patchField(si, fi, { required: e.target.checked })} />
              </InspRow>
            </div>
          ))}

          <button
            type="button"
            style={{ fontSize: 11, padding: "3px 8px", border: "0.5px solid var(--rule-2)", borderRadius: 5, background: "var(--paper-2)", cursor: "pointer", marginTop: 2 }}
            onClick={() => addField(si)}
          >+ Add field</button>
        </InspSection>
      ))}

      <div style={{ padding: "0 12px 12px" }}>
        <button
          type="button"
          style={{ fontSize: 12, width: "100%", padding: "6px 0", border: "0.5px dashed var(--rule-2)", borderRadius: 6, background: "transparent", cursor: "pointer" }}
          onClick={() => onPatch("steps", [...steps, { title: `Step ${steps.length + 1}`, fields: [] }])}
        >+ Add step</button>
      </div>
    </>
  );
}
