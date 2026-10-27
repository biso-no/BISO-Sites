import { isAppwriteId, MAX_VALUE_LENGTH } from "@repo/editor/submit-rules";
import type { Block, PageDoc } from "@repo/editor/types";

/**
 * Everything a form submission means is read from the PUBLISHED page, never
 * from the request: who gets the email, which mode, the topic, the access
 * team, the field labels and the choices on offer. The request names only a
 * block and carries answers, so a caller can neither pick a recipient (open
 * relay) nor widen who can read what they submit.
 */

export const MAX_DATA_JSON_LENGTH = 16_384;
export const MAX_TOPIC_LENGTH = 100;
const MAX_HEADING_LENGTH = 200;
const MAX_LIST_ITEMS = 50;

export type SubmittedValue = string | string[] | boolean;

export interface ResolvedSubmission {
  accessTeamId?: string;
  /** Answers by field name. Choices are stored as the option's label. */
  data: Record<string, SubmittedValue>;
  /** Labels in the block's field order, for the email. */
  fields: { label: string; name: string }[];
  formHeading: string;
  mode: "database" | "email";
  recipientEmail?: string;
  source: "multiStepForm" | "signup";
  /** The block named a team that is not a valid Appwrite id; no grant made. */
  teamDropped: boolean;
  topic: string;
}

export type SubmissionResolution =
  | { ok: true; submission: ResolvedSubmission }
  | {
      ok: false;
      reason: "empty" | "not-a-form" | "too-large" | "unknown-block";
    };

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";

function findBlock(doc: PageDoc, blockId: string): Block | null {
  for (const section of doc.sections ?? []) {
    for (const column of section.columns ?? []) {
      for (const block of column.blocks ?? []) {
        if (block?.id === blockId) {
          return block;
        }
      }
    }
  }
  return null;
}

interface FieldDefinition {
  label: string;
  name: string;
  options: { label: string; value: string }[];
  type: string;
}

function optionsOf(field: unknown): FieldDefinition["options"] {
  const raw = (field as { options?: unknown })?.options;
  return (Array.isArray(raw) ? raw : [])
    .filter((o) => o && typeof o === "object")
    .map((o) => ({ label: text(o.label), value: text(o.value) }))
    .filter((o) => o.value !== "");
}

function fieldsOf(block: Block): FieldDefinition[] {
  if (block.type === "signup") {
    return [{ label: "Email", name: "email", options: [], type: "email" }];
  }
  if (block.type !== "multiStepForm") {
    return [];
  }
  const fields: FieldDefinition[] = [];
  for (const step of Array.isArray(block.steps) ? block.steps : []) {
    for (const field of Array.isArray(step?.fields) ? step.fields : []) {
      const name = text(field?.name);
      // `hidden` fields are never sent by the form, so nothing may fill them.
      if (
        name &&
        field.fieldType !== "hidden" &&
        !fields.some((known) => known.name === name)
      ) {
        fields.push({
          label: text(field.label) || name,
          name,
          options: optionsOf(field),
          type: text(field.fieldType) || "text",
        });
      }
    }
  }
  return fields;
}

const labelFor = (field: FieldDefinition, value: string): string | undefined =>
  field.options.find((option) => option.value === value)?.label;

/** The stored answer, or undefined when it does not fit the field's type. */
function cleanValue(
  field: FieldDefinition,
  value: unknown
): SubmittedValue | undefined {
  const { options, type } = field;
  if (type === "select" || type === "radio") {
    return typeof value === "string" ? labelFor(field, value) : undefined;
  }
  if (type === "checkbox") {
    if (options.length === 0) {
      return typeof value === "boolean" ? value : undefined;
    }
    if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
      return;
    }
    const labels = value.map((item) =>
      typeof item === "string" ? labelFor(field, item) : undefined
    );
    return labels.every((label) => label !== undefined)
      ? (labels as string[])
      : undefined;
  }
  if (typeof value !== "string") {
    return;
  }
  const clamped = value.slice(0, MAX_VALUE_LENGTH);
  if (type === "email" && clamped.trim() !== "") {
    return EMAIL_SHAPE.test(clamped.trim()) ? clamped.trim() : undefined;
  }
  return clamped;
}

export function resolveSubmission(
  doc: PageDoc,
  blockId: string,
  data: unknown
): SubmissionResolution {
  const block = findBlock(doc, blockId);
  if (!block) {
    return { ok: false, reason: "unknown-block" };
  }
  if (block.type !== "signup" && block.type !== "multiStepForm") {
    return { ok: false, reason: "not-a-form" };
  }

  const answers =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const fields = fieldsOf(block);
  const clean: Record<string, SubmittedValue> = {};
  for (const field of fields) {
    if (!Object.hasOwn(answers, field.name)) {
      continue;
    }
    const value = cleanValue(field, answers[field.name]);
    if (value !== undefined) {
      clean[field.name] = value;
    }
  }
  if (Object.keys(clean).length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (JSON.stringify(clean).length > MAX_DATA_JSON_LENGTH) {
    return { ok: false, reason: "too-large" };
  }

  const heading = text(block.heading).trim();
  const fallbackTopic = block.type === "signup" ? "signup" : "form";
  const topic = (text(block.topic).trim() || heading || fallbackTopic).slice(
    0,
    MAX_TOPIC_LENGTH
  );
  const team =
    block.type === "multiStepForm" ? text(block.accessTeamId).trim() : "";

  return {
    ok: true,
    submission: {
      accessTeamId: isAppwriteId(team) ? team : undefined,
      data: clean,
      fields: fields.map(({ label, name }) => ({ label, name })),
      formHeading: (heading || topic).slice(0, MAX_HEADING_LENGTH),
      mode: block.submitMode === "email" ? "email" : "database",
      recipientEmail: text(block.recipientEmail) || undefined,
      source: block.type,
      teamDropped: team !== "" && !isAppwriteId(team),
      topic,
    },
  };
}
