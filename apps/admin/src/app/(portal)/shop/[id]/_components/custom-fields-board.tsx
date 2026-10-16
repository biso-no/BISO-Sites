"use client";

import { Plus, Trash2 } from "lucide-react";
import { BRAND } from "../../_components/shop-studio-theme";

/**
 * The field types the storefront knows how to render. `select` is the only one
 * that uses `options`; everything else is a single input, and `email` /
 * `number` differ from `text` only in the input type and validation.
 */
export const CUSTOM_FIELD_TYPES = [
  { hint: "Single line of text", label: "Text", value: "text" },
  { hint: "Multiple lines", label: "Paragraph", value: "textarea" },
  { hint: "Digits only", label: "Number", value: "number" },
  { hint: "Validated email address", label: "Email", value: "email" },
  { hint: "Pick one of your options", label: "Dropdown", value: "select" },
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number]["value"];

/**
 * One checkout question as the editor holds it.
 *
 * `id` is the Appwrite `product_custom_fields` row id, absent until the field
 * has been saved once. `uid` is a client-only React key, because a brand-new
 * field has no id yet and two new fields must still be distinguishable.
 */
export interface CustomFieldDraft {
  helpText: string;
  id?: string;
  label: string;
  options: string[];
  placeholder: string;
  required: boolean;
  type: CustomFieldType;
  uid: string;
}

export function newCustomField(): CustomFieldDraft {
  return {
    helpText: "",
    label: "",
    options: [],
    placeholder: "",
    required: false,
    type: "text",
    uid: `new-${Math.random().toString(36).slice(2, 10)}`,
  };
}

const inputStyle = {
  background: "transparent",
  border: `0.5px solid ${BRAND.rule2}`,
  borderRadius: 6,
  color: BRAND.ink,
  fontSize: 13,
  outline: 0,
  padding: "5px 8px",
  width: "100%",
} as const;

const labelStyle = {
  color: BRAND.ink4,
  display: "block",
  fontSize: 10.5,
  letterSpacing: ".05em",
  marginBottom: 4,
  textTransform: "uppercase",
} as const;

function RequiredToggle({
  onChange,
  value,
}: {
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {[
        { active: !value, label: "Optional", next: false },
        { active: value, label: "Required", next: true },
      ].map((option) => (
        <button
          key={option.label}
          onClick={() => onChange(option.next)}
          style={{
            background: option.active ? BRAND.ink : BRAND.paper2,
            border: `0.5px solid ${option.active ? BRAND.ink : BRAND.rule2}`,
            borderRadius: 6,
            color: option.active ? "white" : BRAND.ink3,
            cursor: "pointer",
            fontSize: 11.5,
            padding: "5px 10px",
            transition: "background .12s, border-color .12s",
          }}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function OptionsEditor({
  onChange,
  options,
}: {
  onChange: (options: string[]) => void;
  options: string[];
}) {
  return (
    <div>
      <span style={labelStyle}>Dropdown options</span>
      {options.map((option, index) => (
        <div
          // Options are plain strings with no stable identity of their own, and
          // reordering is not offered, so the index is the honest key here.
          key={`option-${index}`}
          style={{ display: "flex", gap: 6, marginBottom: 6 }}
        >
          <input
            onChange={(event) =>
              onChange(
                options.map((existing, at) =>
                  at === index ? event.target.value : existing
                )
              )
            }
            placeholder={`Option ${index + 1}`}
            style={inputStyle}
            value={option}
          />
          <button
            aria-label={`Remove option ${index + 1}`}
            onClick={() => onChange(options.filter((_, at) => at !== index))}
            style={{
              background: "transparent",
              border: `0.5px solid ${BRAND.rule2}`,
              borderRadius: 6,
              color: BRAND.ink4,
              cursor: "pointer",
              padding: "5px 8px",
            }}
            type="button"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...options, ""])}
        style={{
          background: "transparent",
          border: `0.5px dashed ${BRAND.rule2}`,
          borderRadius: 6,
          color: BRAND.ink3,
          cursor: "pointer",
          fontSize: 11.5,
          padding: "5px 10px",
        }}
        type="button"
      >
        <Plus size={11} style={{ marginRight: 4 }} /> Add option
      </button>
    </div>
  );
}

function FieldCard({
  field,
  index,
  onChange,
  onRemove,
}: {
  field: CustomFieldDraft;
  index: number;
  onChange: (patch: Partial<CustomFieldDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        borderTop: index > 0 ? `0.5px solid ${BRAND.rule}` : 0,
        display: "grid",
        gap: 10,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "1fr 150px 44px",
        }}
      >
        <div>
          <span style={labelStyle}>Question</span>
          <input
            onChange={(event) => onChange({ label: event.target.value })}
            placeholder="e.g. Locker number"
            style={inputStyle}
            value={field.label}
          />
        </div>
        <div>
          <span style={labelStyle}>Answer type</span>
          <select
            onChange={(event) =>
              onChange({ type: event.target.value as CustomFieldType })
            }
            style={inputStyle}
            value={field.type}
          >
            {CUSTOM_FIELD_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          aria-label={`Remove ${field.label || "field"}`}
          onClick={onRemove}
          style={{
            alignSelf: "end",
            background: "transparent",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 6,
            color: BRAND.ink4,
            cursor: "pointer",
            padding: "6px 8px",
          }}
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "1fr 1fr 170px",
        }}
      >
        <div>
          <span style={labelStyle}>Placeholder</span>
          <input
            onChange={(event) => onChange({ placeholder: event.target.value })}
            placeholder="Shown inside the empty box"
            style={inputStyle}
            value={field.placeholder}
          />
        </div>
        <div>
          <span style={labelStyle}>Help text</span>
          <input
            onChange={(event) => onChange({ helpText: event.target.value })}
            placeholder="Guidance shown under the box"
            style={inputStyle}
            value={field.helpText}
          />
        </div>
        <div>
          <span style={labelStyle}>Answer needed?</span>
          <RequiredToggle
            onChange={(required) => onChange({ required })}
            value={field.required}
          />
        </div>
      </div>

      {field.type === "select" && (
        <OptionsEditor
          onChange={(options) => onChange({ options })}
          options={field.options}
        />
      )}
    </div>
  );
}

/**
 * Editor for the questions a buyer answers when they add this product to their
 * basket — a locker number, a shirt size, an allergy note.
 *
 * The answers are stored on the order line, not on the product, so changing a
 * question here never rewrites what someone already answered.
 */
export function CustomFieldsBoard({
  fields,
  setFields,
}: {
  fields: CustomFieldDraft[];
  setFields: (fields: CustomFieldDraft[]) => void;
}) {
  const update = (uid: string, patch: Partial<CustomFieldDraft>) =>
    setFields(
      fields.map((field) =>
        field.uid === uid ? { ...field, ...patch } : field
      )
    );

  return (
    <div>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              color: BRAND.ink3,
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: ".05em",
              textTransform: "uppercase",
            }}
          >
            Checkout questions
          </div>
          <p
            style={{
              color: BRAND.ink4,
              fontSize: 11.5,
              lineHeight: 1.45,
              margin: "4px 0 0",
              maxWidth: 460,
            }}
          >
            Asked while buying, and saved on the order — use them for details
            you need from the student, like a locker number or a shirt size.
          </p>
        </div>
        <button
          onClick={() => setFields([...fields, newCustomField()])}
          style={{
            background: BRAND.ink,
            border: 0,
            borderRadius: 8,
            color: "white",
            cursor: "pointer",
            fontSize: 12,
            padding: "7px 12px",
            whiteSpace: "nowrap",
          }}
          type="button"
        >
          <Plus size={12} style={{ marginRight: 4 }} /> Add question
        </button>
      </div>

      {fields.length === 0 ? (
        <div
          style={{
            border: `0.5px dashed ${BRAND.rule2}`,
            borderRadius: 12,
            color: BRAND.ink4,
            fontSize: 12,
            padding: "18px 14px",
            textAlign: "center",
          }}
        >
          No questions — buyers go straight to checkout.
        </div>
      ) : (
        <div
          style={{
            background: "rgba(255,255,255,.5)",
            border: `0.5px solid ${BRAND.rule2}`,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {fields.map((field, index) => (
            <FieldCard
              field={field}
              index={index}
              key={field.uid}
              onChange={(patch) => update(field.uid, patch)}
              onRemove={() =>
                setFields(fields.filter((other) => other.uid !== field.uid))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
