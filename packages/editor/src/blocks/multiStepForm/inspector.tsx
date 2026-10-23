"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import { SubmissionFields } from "@/components/editor-shell/inspector/submission-fields";
import type {
  FormField,
  FormFieldOption,
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

const FIELD_TYPES: { label: string; value: FormFieldType }[] = [
  { label: "Text", value: "text" },
  { label: "Email", value: "email" },
  { label: "Textarea", value: "textarea" },
  { label: "Dropdown", value: "select" },
  { label: "Radio", value: "radio" },
  { label: "Checkbox", value: "checkbox" },
  { label: "Hidden", value: "hidden" },
];

const HAS_OPTIONS = new Set<string>(["select", "radio", "checkbox"]);

const slugName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "_");

function OptionsEditor({
  field,
  update,
}: {
  field: FormField;
  update: (next: FormField) => void;
}) {
  return (
    <ItemList<FormFieldOption>
      addLabel="+ Add option"
      items={listOf<FormFieldOption>(field.options)}
      newItem={() => ({ label: "Option", value: `option_${Date.now()}` })}
      onChange={(options) => update({ ...field, options })}
      renderItem={(option, updateOption) => (
        <>
          <InspRow label="Label">
            <input
              onChange={(e) =>
                updateOption({
                  ...option,
                  label: e.target.value,
                  value: slugName(e.target.value) || option.value,
                })
              }
              value={option.label ?? ""}
            />
          </InspRow>
        </>
      )}
      title={(option, i) =>
        (typeof option.label === "string" && option.label) || `Option ${i + 1}`
      }
    />
  );
}

function FieldEditor({
  field,
  update,
}: {
  field: FormField;
  update: (next: FormField) => void;
}) {
  return (
    <>
      <InspRow label="Label">
        <input
          onChange={(e) => update({ ...field, label: e.target.value })}
          value={field.label ?? ""}
        />
      </InspRow>
      <InspRow label="Name">
        <input
          onChange={(e) => update({ ...field, name: slugName(e.target.value) })}
          placeholder="field_name"
          value={field.name ?? ""}
        />
      </InspRow>
      <InspRow label="Type">
        <select
          onChange={(e) =>
            update({ ...field, fieldType: e.target.value as FormFieldType })
          }
          value={field.fieldType}
        >
          {FIELD_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </InspRow>
      <InspRow label="Placeholder">
        <input
          onChange={(e) =>
            update({ ...field, placeholder: e.target.value || undefined })
          }
          value={field.placeholder ?? ""}
        />
      </InspRow>
      <label className="pe-check">
        <input
          checked={field.required ?? false}
          onChange={(e) => update({ ...field, required: e.target.checked })}
          type="checkbox"
        />
        Required
      </label>
      {HAS_OPTIONS.has(field.fieldType) ? (
        <OptionsEditor field={field} update={update} />
      ) : null}
    </>
  );
}

export function MultiStepFormInspector({ block, onPatch }: Props) {
  const steps = listOf<FormStep>(block.steps);

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

      <SubmissionFields
        accessTeamId={block.accessTeamId}
        onPatch={onPatch}
        recipientEmail={block.recipientEmail}
        submitMode={block.submitMode}
        topic={block.topic}
        withTeam
      />

      <InspSection label="Steps">
        <ItemList<FormStep>
          addLabel="+ Add step"
          items={steps}
          newItem={() => ({
            fields: [],
            title: `Step ${steps.length + 1}`,
          })}
          onChange={(next) => onPatch("steps", next)}
          renderItem={(step, updateStep) => (
            <>
              <InspRow label="Title">
                <input
                  onChange={(e) =>
                    updateStep({ ...step, title: e.target.value })
                  }
                  value={step.title ?? ""}
                />
              </InspRow>
              <ItemList<FormField>
                addLabel="+ Add field"
                items={listOf<FormField>(step.fields)}
                newItem={() => ({
                  fieldType: "text",
                  label: "New field",
                  name: `field_${Date.now()}`,
                  required: false,
                })}
                onChange={(fields) => updateStep({ ...step, fields })}
                renderItem={(field, updateField) => (
                  <FieldEditor field={field} update={updateField} />
                )}
                title={(field, i) =>
                  (typeof field.label === "string" && field.label) ||
                  `Field ${i + 1}`
                }
              />
            </>
          )}
          title={(step, i) =>
            (typeof step.title === "string" && step.title) || `Step ${i + 1}`
          }
        />
      </InspSection>
    </>
  );
}
