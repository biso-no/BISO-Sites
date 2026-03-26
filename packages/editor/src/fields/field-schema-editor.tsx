"use client";

import type { CustomField } from "@puckeditor/core";
import { GripVertical, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import type {
  TemplateFieldSchema,
  TemplateFieldType,
  TemplateFieldOption,
  EditorialQueryCollection,
} from "@repo/api/editorial";

const FIELD_TYPES: { value: TemplateFieldType; label: string; description: string }[] = [
  { value: "text", label: "Text", description: "Single line of text" },
  { value: "textarea", label: "Text Area", description: "Multi-line text" },
  { value: "rich-text", label: "Rich Text", description: "Formatted text with HTML editor" },
  { value: "number", label: "Number", description: "Numeric value" },
  { value: "boolean", label: "Toggle", description: "Yes/No switch" },
  { value: "url", label: "URL", description: "Web address" },
  { value: "image", label: "Image", description: "Image upload or URL" },
  { value: "select", label: "Dropdown", description: "Choose from predefined options" },
  { value: "relation", label: "Related Content", description: "Link to other content" },
  { value: "date", label: "Date", description: "Date picker" },
];

const COLLECTIONS: { value: EditorialQueryCollection; label: string }[] = [
  { value: "events", label: "Events" },
  { value: "news", label: "News" },
  { value: "jobs", label: "Jobs" },
  { value: "products", label: "Products" },
  { value: "content_entries", label: "Content Pages" },
];

function generateFieldId(): string {
  return `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function FieldCard({
  field,
  index,
  isExpanded,
  onToggle,
  onChange,
  onRemove,
  readOnly,
}: {
  field: TemplateFieldSchema;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onChange: (updated: TemplateFieldSchema) => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const typeInfo = FIELD_TYPES.find((t) => t.value === field.type);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header - always visible */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <GripVertical size={14} className="text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {field.label || `Field ${index + 1}`}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {typeInfo?.label ?? field.type}
            </span>
            {field.required && (
              <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">
                Required
              </span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown size={14} className="text-gray-400" />
        ) : (
          <ChevronRight size={14} className="text-gray-400" />
        )}
      </div>

      {/* Expanded settings */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-3 py-3 flex flex-col gap-3">
          {/* Label */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Label</label>
            <input
              type="text"
              className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
              placeholder="Field label..."
              value={field.label}
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              disabled={readOnly}
            />
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Type</label>
            <select
              className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
              value={field.type}
              onChange={(e) =>
                onChange({ ...field, type: e.target.value as TemplateFieldType })
              }
              disabled={readOnly}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label} - {t.description}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Help text (optional)
            </label>
            <input
              type="text"
              className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
              placeholder="Instructions for content editors..."
              value={field.description ?? ""}
              onChange={(e) =>
                onChange({ ...field, description: e.target.value || undefined })
              }
              disabled={readOnly}
            />
          </div>

          {/* Placeholder */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">
              Placeholder (optional)
            </label>
            <input
              type="text"
              className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
              placeholder="Placeholder text..."
              value={field.placeholder ?? ""}
              onChange={(e) =>
                onChange({ ...field, placeholder: e.target.value || undefined })
              }
              disabled={readOnly}
            />
          </div>

          {/* Toggles row */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.required ?? false}
                onChange={(e) =>
                  onChange({ ...field, required: e.target.checked })
                }
                disabled={readOnly}
                className="rounded"
              />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.localized ?? false}
                onChange={(e) =>
                  onChange({ ...field, localized: e.target.checked })
                }
                disabled={readOnly}
                className="rounded"
              />
              Translatable
            </label>
          </div>

          {/* Select options */}
          {field.type === "select" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500">
                Options
              </label>
              <SelectOptionsEditor
                options={field.options ?? []}
                onChange={(options) => onChange({ ...field, options })}
                readOnly={readOnly}
              />
            </div>
          )}

          {/* Relation collection */}
          {field.type === "relation" && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">
                  Content collection
                </label>
                <select
                  className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
                  value={field.collection ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...field,
                      collection: (e.target.value || undefined) as EditorialQueryCollection,
                    })
                  }
                  disabled={readOnly}
                >
                  <option value="">Select collection...</option>
                  {COLLECTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.allowMultiple ?? false}
                  onChange={(e) =>
                    onChange({ ...field, allowMultiple: e.target.checked })
                  }
                  disabled={readOnly}
                  className="rounded"
                />
                Allow multiple selections
              </label>
            </div>
          )}

          {/* Default value */}
          {field.type !== "relation" && field.type !== "rich-text" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">
                Default value (optional)
              </label>
              <input
                type={field.type === "number" ? "number" : "text"}
                className="rounded-md border border-gray-200 px-2.5 py-1.5 text-sm"
                placeholder="Default value..."
                value={
                  field.defaultValue != null ? String(field.defaultValue) : ""
                }
                onChange={(e) =>
                  onChange({
                    ...field,
                    defaultValue: e.target.value || undefined,
                  })
                }
                disabled={readOnly}
              />
            </div>
          )}

          {/* Remove button */}
          {!readOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md px-2 py-1.5 self-start transition-colors"
            >
              <Trash2 size={12} />
              Remove field
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SelectOptionsEditor({
  options,
  onChange,
  readOnly,
}: {
  options: TemplateFieldOption[];
  onChange: (options: TemplateFieldOption[]) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="text"
            className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm"
            placeholder="Label"
            value={opt.label}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...opt, label: e.target.value };
              onChange(next);
            }}
            disabled={readOnly}
          />
          <input
            type="text"
            className="w-24 rounded-md border border-gray-200 px-2 py-1 text-sm"
            placeholder="Value"
            value={opt.value}
            onChange={(e) => {
              const next = [...options];
              next[i] = { ...opt, value: e.target.value };
              onChange(next);
            }}
            disabled={readOnly}
          />
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="text-gray-400 hover:text-red-500 p-0.5"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...options, { label: "", value: "" }])}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-1 py-1"
        >
          <Plus size={12} />
          Add option
        </button>
      )}
    </div>
  );
}

export function fieldSchemaEditorField({
  label = "Content Fields",
}: {
  label?: string;
} = {}): CustomField<TemplateFieldSchema[]> {
  return {
    type: "custom",
    label,
    render: function FieldSchemaEditorRenderer({ value, onChange, readOnly }) {
      const fields: TemplateFieldSchema[] = value ?? [];
      const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

      const handleAdd = useCallback(() => {
        if (readOnly) return;
        const newField: TemplateFieldSchema = {
          id: generateFieldId(),
          label: "",
          type: "text",
          required: false,
          localized: true,
        };
        const next = [...fields, newField];
        onChange(next);
        setExpandedIndex(next.length - 1);
      }, [fields, onChange, readOnly]);

      const handleChange = useCallback(
        (index: number, updated: TemplateFieldSchema) => {
          if (readOnly) return;
          const next = [...fields];
          next[index] = updated;
          onChange(next);
        },
        [fields, onChange, readOnly],
      );

      const handleRemove = useCallback(
        (index: number) => {
          if (readOnly) return;
          onChange(fields.filter((_, i) => i !== index));
          setExpandedIndex(null);
        },
        [fields, onChange, readOnly],
      );

      return (
        <div className="flex flex-col gap-2">
          {fields.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
              <p className="text-sm text-gray-500 mb-2">
                No content fields defined yet
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Content fields let editors fill in page-specific data like
                titles, descriptions, and images.
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={handleAdd}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus size={14} />
                  Add first field
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                {fields.map((field, index) => (
                  <FieldCard
                    key={field.id}
                    field={field}
                    index={index}
                    isExpanded={expandedIndex === index}
                    onToggle={() =>
                      setExpandedIndex(expandedIndex === index ? null : index)
                    }
                    onChange={(updated) => handleChange(index, updated)}
                    onRemove={() => handleRemove(index)}
                    readOnly={readOnly}
                  />
                ))}
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={handleAdd}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  <Plus size={14} />
                  Add field
                </button>
              )}
            </>
          )}
        </div>
      );
    },
  };
}
