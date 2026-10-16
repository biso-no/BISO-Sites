/**
 * Decides what a save must write to `product_custom_fields`.
 *
 * Pure and free of Appwrite so it can be unit-tested: the server action just
 * executes the plan. Lives outside the `"use server"` module because those may
 * only export async functions.
 */

/** A field as the product form submits it. */
export interface CustomFieldInput {
  help_text?: string | null;
  /** Appwrite row id; absent for a field the editor has just added. */
  id?: string;
  label: string;
  options?: string[];
  placeholder?: string | null;
  required: boolean;
  type: string;
}

/** A stored row, as much of it as the plan needs. */
export interface StoredCustomField {
  $id: string;
  field_key?: string | null;
}

export interface CustomFieldWrite {
  data: Record<string, unknown>;
  rowId: string;
}

export interface CustomFieldSyncPlan {
  /** Row ids to delete — fields the editor removed. */
  deletes: string[];
  writes: CustomFieldWrite[];
}

/**
 * Builds the delete/upsert plan for one product.
 *
 * The subtle part is `field_key`. It is the id recorded in every
 * `order_item_field_answers` row written so far, and for a field imported
 * from WordPress it differs from the row id (`wpf690240cfef18e` vs
 * `690240cfef18e`). So an existing row keeps whatever key it already has, and
 * only a brand-new field gets one derived from its fresh row id. Relabelling a
 * question therefore never detaches the answers already given to it.
 */
export function planCustomFieldSync({
  existing,
  newRowId,
  productId,
  requested,
}: {
  existing: StoredCustomField[];
  /** Injected so callers (and tests) control id generation. */
  newRowId: () => string;
  productId: string;
  requested: CustomFieldInput[];
}): CustomFieldSyncPlan {
  const keyByRowId = new Map(
    existing.map((field) => [field.$id, field.field_key ?? field.$id])
  );
  const requestedIds = new Set(
    requested.map((field) => field.id).filter((id): id is string => Boolean(id))
  );

  const deletes = existing
    .filter((field) => !requestedIds.has(field.$id))
    .map((field) => field.$id);

  const writes = requested.map((field, sortOrder) => {
    // `field.id` is only trusted when it names a row already on this product;
    // a client-supplied id for someone else's row must not be written to.
    const existingKey = field.id ? keyByRowId.get(field.id) : undefined;
    const rowId = existingKey === undefined ? newRowId() : (field.id as string);
    return {
      data: {
        enabled: true,
        field_key: existingKey ?? rowId,
        help_text: field.help_text || null,
        is_required: field.required,
        label: field.label,
        // Options are meaningless for every type but `select`, and leaving a
        // stale list behind would resurrect it if the type were switched back.
        options: field.type === "select" ? (field.options ?? []) : [],
        placeholder: field.placeholder || null,
        product: productId,
        sort_order: sortOrder,
        type: field.type,
      },
      rowId,
    };
  });

  return { deletes, writes };
}
