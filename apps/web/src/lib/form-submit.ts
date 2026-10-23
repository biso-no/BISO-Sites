import type { Block, PageDoc } from "@repo/editor/types";

/**
 * Everything a form submission means is read from the PUBLISHED page, never
 * from the request: who gets the email, which mode, the topic, the access
 * team, the field labels. The request names only a block and carries answers,
 * so a caller can neither pick a recipient (open relay) nor widen who can
 * read what they submit.
 */

export const MAX_VALUE_LENGTH = 2000;
export const MAX_DATA_JSON_LENGTH = 16_384;
export const MAX_TOPIC_LENGTH = 100;
const MAX_HEADING_LENGTH = 200;
const MAX_LIST_ITEMS = 50;

export type SubmittedValue = string | string[] | boolean;

export interface ResolvedSubmission {
  accessTeamId?: string;
  data: Record<string, SubmittedValue>;
  /** Labels in the block's field order, for the email. */
  fields: { label: string; name: string }[];
  formHeading: string;
  mode: "database" | "email";
  recipientEmail?: string;
  source: "multiStepForm" | "signup";
  topic: string;
}

export type SubmissionResolution =
  | { ok: true; submission: ResolvedSubmission }
  | {
      ok: false;
      reason: "empty" | "not-a-form" | "too-large" | "unknown-block";
    };

/** A single `@biso.no` mailbox. No separators, whitespace or other domains. */
const BISO_ADDRESS = /^[^\s@,;<>()"'\\]+@biso\.no$/i;

export function isBisoRecipient(value: unknown): value is string {
  return typeof value === "string" && BISO_ADDRESS.test(value);
}

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
}

function fieldsOf(block: Block): FieldDefinition[] {
  if (block.type === "signup") {
    return [{ label: "Email", name: "email" }];
  }
  if (block.type !== "multiStepForm") {
    return [];
  }
  const fields: FieldDefinition[] = [];
  for (const step of Array.isArray(block.steps) ? block.steps : []) {
    for (const field of Array.isArray(step?.fields) ? step.fields : []) {
      const name = text(field?.name);
      if (name && !fields.some((known) => known.name === name)) {
        fields.push({ label: text(field.label) || name, name });
      }
    }
  }
  return fields;
}

function cleanValue(value: unknown): SubmittedValue | undefined {
  if (typeof value === "string") {
    return value.slice(0, MAX_VALUE_LENGTH);
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .slice(0, MAX_LIST_ITEMS)
      .map((item) => item.slice(0, MAX_VALUE_LENGTH));
  }
  return;
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
  for (const { name } of fields) {
    if (!Object.hasOwn(answers, name)) {
      continue;
    }
    const value = cleanValue(answers[name]);
    if (value !== undefined) {
      clean[name] = value;
    }
  }
  if (Object.keys(clean).length === 0) {
    return { ok: false, reason: "empty" };
  }
  if (JSON.stringify(clean).length > MAX_DATA_JSON_LENGTH) {
    return { ok: false, reason: "too-large" };
  }

  const heading = text(block.heading);
  const fallbackTopic = block.type === "signup" ? "signup" : "form";
  const topic = (text(block.topic).trim() || fallbackTopic).slice(
    0,
    MAX_TOPIC_LENGTH
  );
  const team =
    block.type === "multiStepForm" ? text(block.accessTeamId).trim() : "";

  return {
    ok: true,
    submission: {
      accessTeamId: team || undefined,
      data: clean,
      fields,
      formHeading: (heading || topic).slice(0, MAX_HEADING_LENGTH),
      mode: block.submitMode === "email" ? "email" : "database",
      recipientEmail: text(block.recipientEmail) || undefined,
      source: block.type,
      topic,
    },
  };
}
