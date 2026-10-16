/**
 * A product's checkout questions, and the rules for the answers to them.
 *
 * Two checkout paths reach these: the website's `createCartCheckoutSession`
 * server action, and `apps/api`'s `/api/payment/[provider]/checkout`, which the
 * native app posts to directly. Both persist the answers onto the order, and
 * fulfilment reads them back — a missing size or a fabricated label is an order
 * nobody can pack. The rules therefore live here rather than in either app, so
 * a client that talks to one cannot be held to a weaker standard than a client
 * that talks to the other.
 */

export type ProductCustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "email";

export interface ProductCustomField {
  helpText?: string;
  id: string;
  label: string;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  type: ProductCustomFieldType;
}

/**
 * A `product_custom_fields` row as it is read back. Declared here rather than
 * taken from the generated Appwrite types so callers are not blocked on
 * regenerating them after the table is pushed.
 */
export interface ProductCustomFieldRow {
  $id: string;
  enabled?: boolean | null;
  field_key?: string | null;
  help_text?: string | null;
  is_required?: boolean | null;
  label?: string | null;
  options?: string[] | null;
  placeholder?: string | null;
  sort_order?: number | null;
  type?: string | null;
}

const CUSTOM_FIELD_TYPES = new Set<ProductCustomFieldType>([
  "text",
  "textarea",
  "number",
  "select",
  "email",
]);

/**
 * Turns stored rows into the shape the storefront and checkout both use.
 *
 * `id` is the row's `field_key`, not its `$id`: that key is what gets written
 * onto each `order_item_field_answers` row, and imported WordPress fields carry
 * a key that differs from their row id.
 */
export function toProductCustomFields(
  rows: ProductCustomFieldRow[] | null | undefined
): ProductCustomField[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows
    .filter((row) => row.enabled !== false && row.label)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((row) => {
      const type = (row.type ?? "text") as ProductCustomFieldType;
      return {
        helpText: row.help_text ?? undefined,
        id: row.field_key ?? row.$id,
        label: row.label as string,
        options: row.options ?? undefined,
        placeholder: row.placeholder ?? undefined,
        required: row.is_required ?? false,
        type: CUSTOM_FIELD_TYPES.has(type) ? type : "text",
      };
    });
}

export interface ResolvedCustomFieldAnswers {
  /** Answers keyed by field id, for the fields this product actually declares. */
  accepted: Record<string, string>;
  /** The same answers with their labels, as fulfilment renders them. */
  details: Array<{ id: string; label: string; value: string }>;
  /** Labels of required questions the buyer left blank. */
  missing: string[];
}

/**
 * Reconciles a buyer's answers against what the product actually asks.
 *
 * Everything is derived from the definitions, never from the caller: a key the
 * product does not declare is dropped, and every label comes from the stored
 * field rather than from the request. A client cannot therefore invent a
 * question, relabel a real one, or skip a required one — it can only answer
 * what is there.
 *
 * Reporting `missing` rather than throwing lets each caller signal it in its
 * own idiom: the website raises, the API answers 409.
 */
export function resolveCustomFieldAnswers(
  fields: ProductCustomField[],
  responses: Record<string, string> | undefined
): ResolvedCustomFieldAnswers {
  const answers = responses ?? {};
  const accepted: Record<string, string> = {};
  const details: Array<{ id: string; label: string; value: string }> = [];
  const missing: string[] = [];

  for (const field of fields) {
    const value = answers[field.id]?.trim();
    if (!value) {
      if (field.required) {
        missing.push(field.label);
      }
      continue;
    }
    accepted[field.id] = value;
    details.push({ id: field.id, label: field.label, value });
  }

  return { accepted, details, missing };
}
