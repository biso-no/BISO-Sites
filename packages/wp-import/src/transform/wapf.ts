import { plainTextExcerpt } from "./html";

/**
 * WordPress meta as WooCommerce's REST API returns it, on both products and
 * order line items. `value` is `unknown` because WooCommerce unserializes PHP
 * into whatever shape the storing plugin used — WAPF's is an object, but a
 * meta row that failed to unserialize arrives as a raw string.
 */
export interface WpMetaEntry {
  key: string;
  value: unknown;
}

/** Definitions live on the product; answers live on the order line item. */
const FIELD_GROUP_KEY = "_wapf_fieldgroup";
const ANSWERS_KEY = "_wapf_meta";

/** Matches `order_item_field_answers.value` (string, size 4096). */
const CUSTOM_FIELDS_JSON_LIMIT = 4096;
/** Matches `product_custom_fields.label` / `.placeholder` (string, size 255). */
const LABEL_LIMIT = 255;
/** Matches `product_custom_fields.help_text` (string, size 500). */
const HELP_TEXT_LIMIT = 500;
/** Matches `product_custom_fields.options` element size (string[], size 255). */
const OPTION_LIMIT = 255;

/**
 * One answer, in exactly the shape checkout already writes into
 * `order_item_field_answers` rows — see `buildStoredOrderItems` in
 * packages/shared/utils/vipps-order-ops.ts and the reader in
 * packages/shared/utils/order-parsing.ts. Imported rows are indistinguishable
 * from rows a live purchase produces, so the order confirmation page and the
 * admin CSV export render them without a special case.
 */
export interface WapfAnswer {
  id: string;
  label: string;
  value: string;
}

/** Studio-side field types; mirrors the `product_custom_fields.type` enum. */
export type WapfFieldType = "email" | "number" | "select" | "text" | "textarea";

/** One field definition, ready to become a `product_custom_fields` row. */
export interface WapfFieldDefinition {
  fieldKey: string;
  helpText: string | null;
  label: string;
  options: string[];
  placeholder: string | null;
  required: boolean;
  sortOrder: number;
  type: WapfFieldType;
}

/**
 * WAPF's field types mapped onto the studio's. `checkboxes` and `radio` both
 * collapse to `select`: the storefront renders a select for anything with
 * options (see product-options-client.tsx) and the archive holds exactly one
 * checkboxes field, a Yes/No confirmation that a select expresses faithfully.
 * Anything unrecognised degrades to `text` rather than being dropped — a
 * plain text input still captures the answer.
 */
const TYPE_MAP: Record<string, WapfFieldType> = {
  checkbox: "select",
  checkboxes: "select",
  email: "email",
  number: "number",
  radio: "select",
  select: "select",
  text: "text",
  textarea: "textarea",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Tag removal substitutes a space, which is right for prose but leaves
 * `(<span>+kr 10</span>)` as `( +kr 10 )`. These answers are read as-is on the
 * order page and in the admin CSV export, so the padding is closed up again.
 */
const BRACKET_PADDING_PATTERN = /\(\s+|\s+\)/g;

const tidyBrackets = (value: string): string =>
  value.replace(BRACKET_PADDING_PATTERN, (match) =>
    match.trimStart().startsWith("(") ? "(" : ")"
  );

/**
 * Collapses a WAPF-supplied string to plain text: strips the pricing-hint
 * markup WAPF bakes into priced answers, decodes entities and normalizes
 * whitespace. Reuses the importer's existing HTML helper so answers are
 * cleaned the same way descriptions are.
 */
function clean(value: unknown, limit: number): string {
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value !== "string") {
    return "";
  }
  return tidyBrackets(plainTextExcerpt(value, limit)).trim();
}

function findMeta(metaData: WpMetaEntry[] | undefined, key: string): unknown[] {
  if (!Array.isArray(metaData)) {
    return [];
  }
  return metaData.filter((entry) => entry?.key === key).map((e) => e.value);
}

/**
 * Reads a line item's WAPF answers.
 *
 * Only `_wapf_meta` is trusted. The same answers are mirrored into visible
 * meta keyed by label, but so are WooCommerce's own variation attributes
 * (`membership`, `duration`, …), and nothing there distinguishes the two — so
 * reading visible meta would file "Semester" as a custom field answer.
 *
 * The result is capped at the column size by dropping whole trailing answers.
 * Truncating the serialized JSON instead would produce a string that
 * `parseCustomFields` cannot parse, losing every answer on the line rather
 * than just the overflow.
 */
export function parseWapfAnswers(
  metaData: WpMetaEntry[] | undefined
): WapfAnswer[] {
  const answers: WapfAnswer[] = [];

  for (const raw of findMeta(metaData, ANSWERS_KEY)) {
    if (!(isRecord(raw) && Array.isArray(raw.fields))) {
      continue;
    }
    for (const field of raw.fields) {
      if (!isRecord(field)) {
        continue;
      }
      const id = clean(field.id, LABEL_LIMIT);
      const label = clean(field.label, LABEL_LIMIT);
      const value = clean(field.value, CUSTOM_FIELDS_JSON_LIMIT);
      if (!(id && label && value)) {
        continue;
      }
      answers.push({ id, label, value });
    }
  }

  const kept: WapfAnswer[] = [];
  for (const answer of answers) {
    if (JSON.stringify([...kept, answer]).length > CUSTOM_FIELDS_JSON_LIMIT) {
      break;
    }
    kept.push(answer);
  }
  return kept;
}

function readChoices(options: unknown): string[] {
  if (!(isRecord(options) && Array.isArray(options.choices))) {
    return [];
  }
  const labels: string[] = [];
  for (const choice of options.choices) {
    if (!isRecord(choice)) {
      continue;
    }
    const label = clean(choice.label, OPTION_LIMIT);
    if (label) {
      labels.push(label);
    }
  }
  return labels;
}

/**
 * Reads a product's WAPF field definitions.
 *
 * `_wapf_fieldgroup` is repeated for WPML-duplicated products, so identical
 * groups are deduped by field key — importing a group twice would give every
 * product two copies of each field.
 *
 * A field with no label is dropped: the label is the only thing identifying
 * the field to a buyer, and the archive holds four blank ones (product 36249)
 * that would otherwise import as nameless required inputs.
 */
/**
 * One WAPF field as a studio definition, or null when it carries no usable
 * label — the archive holds four such blanks (product 36249) that would
 * otherwise import as nameless required inputs.
 */
function toFieldDefinition(
  field: unknown,
  sortOrder: number
): WapfFieldDefinition | null {
  if (!isRecord(field)) {
    return null;
  }
  const fieldKey = clean(field.id, LABEL_LIMIT);
  const label = clean(field.label, LABEL_LIMIT);
  if (!(fieldKey && label)) {
    return null;
  }
  const options = isRecord(field.options) ? field.options : {};
  const type = TYPE_MAP[String(field.type ?? "")] ?? "text";
  return {
    fieldKey,
    helpText: clean(field.description, HELP_TEXT_LIMIT) || null,
    label,
    options: type === "select" ? readChoices(options) : [],
    placeholder: clean(options.placeholder, LABEL_LIMIT) || null,
    required: field.required === true,
    sortOrder,
    type,
  };
}

export function parseWapfFieldGroup(
  metaData: WpMetaEntry[] | undefined
): WapfFieldDefinition[] {
  const byKey = new Map<string, WapfFieldDefinition>();

  for (const raw of findMeta(metaData, FIELD_GROUP_KEY)) {
    if (!(isRecord(raw) && Array.isArray(raw.fields))) {
      continue;
    }
    for (const field of raw.fields) {
      // sortOrder is the insertion position, so the studio renders the fields
      // in the order the WordPress editor arranged them.
      const definition = toFieldDefinition(field, byKey.size);
      if (definition && !byKey.has(definition.fieldKey)) {
        byKey.set(definition.fieldKey, definition);
      }
    }
  }

  return [...byKey.values()];
}
