import { describe, expect, test } from "bun:test";
import {
  type CustomFieldInput,
  planCustomFieldSync,
  type StoredCustomField,
} from "./custom-fields";

const field = (over: Partial<CustomFieldInput> = {}): CustomFieldInput => ({
  label: "Locker number",
  required: true,
  type: "text",
  ...over,
});

function plan({
  existing = [],
  requested,
}: {
  existing?: StoredCustomField[];
  requested: CustomFieldInput[];
}) {
  let counter = 0;
  return planCustomFieldSync({
    existing,
    newRowId: () => `new-${++counter}`,
    productId: "prod-1",
    requested,
  });
}

describe("planCustomFieldSync", () => {
  test("creates a row and keys its answers by that new row id", () => {
    const { deletes, writes } = plan({ requested: [field()] });

    expect(deletes).toEqual([]);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.rowId).toBe("new-1");
    expect(writes[0]?.data.field_key).toBe("new-1");
    expect(writes[0]?.data.product).toBe("prod-1");
  });

  test("preserves an imported field's key, which differs from its row id", () => {
    // The whole point: answers on historical WordPress orders are recorded
    // under "690240cfef18e", while the row is "wpf690240cfef18e".
    const { writes } = plan({
      existing: [{ $id: "wpf690240cfef18e", field_key: "690240cfef18e" }],
      requested: [field({ id: "wpf690240cfef18e", label: "Fullt navn" })],
    });

    expect(writes[0]?.rowId).toBe("wpf690240cfef18e");
    expect(writes[0]?.data.field_key).toBe("690240cfef18e");
  });

  test("relabelling a question keeps its key, so old answers stay attached", () => {
    const { writes } = plan({
      existing: [{ $id: "row-1", field_key: "row-1" }],
      requested: [
        field({ id: "row-1", label: "Completely different wording" }),
      ],
    });

    expect(writes[0]?.data.field_key).toBe("row-1");
    expect(writes[0]?.data.label).toBe("Completely different wording");
  });

  test("deletes rows the editor dropped", () => {
    const { deletes, writes } = plan({
      existing: [
        { $id: "row-1", field_key: "row-1" },
        { $id: "row-2", field_key: "row-2" },
      ],
      requested: [field({ id: "row-2" })],
    });

    expect(deletes).toEqual(["row-1"]);
    expect(writes).toHaveLength(1);
  });

  test("treats an id that names no row on this product as a new field", () => {
    // Guards against a client posting another product's row id and having this
    // save write over it.
    const { deletes, writes } = plan({
      existing: [{ $id: "row-1", field_key: "row-1" }],
      requested: [field({ id: "someone-elses-row" })],
    });

    expect(writes[0]?.rowId).toBe("new-1");
    expect(deletes).toEqual(["row-1"]);
  });

  test("numbers sort_order by position so the storefront matches the editor", () => {
    const { writes } = plan({
      requested: [
        field({ label: "First" }),
        field({ label: "Second" }),
        field({ label: "Third" }),
      ],
    });

    expect(writes.map((w) => w.data.sort_order)).toEqual([0, 1, 2]);
    expect(writes.map((w) => w.data.label)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  test("keeps options only for select, so a type switch cannot resurrect them", () => {
    const { writes } = plan({
      requested: [
        field({ label: "Menu", options: ["Meat", "Vegan"], type: "select" }),
        field({ label: "Name", options: ["stale"], type: "text" }),
      ],
    });

    expect(writes[0]?.data.options).toEqual(["Meat", "Vegan"]);
    expect(writes[1]?.data.options).toEqual([]);
  });

  test("maps required onto is_required, the actual column", () => {
    const { writes } = plan({
      requested: [
        field({ label: "Needed", required: true }),
        field({ label: "Not needed", required: false }),
      ],
    });

    expect(writes[0]?.data.is_required).toBe(true);
    expect(writes[1]?.data.is_required).toBe(false);
    expect(writes[0]?.data.required).toBeUndefined();
  });

  test("normalizes blank optional text to null rather than empty strings", () => {
    const { writes } = plan({
      requested: [field({ help_text: "", placeholder: "" })],
    });

    expect(writes[0]?.data.help_text).toBeNull();
    expect(writes[0]?.data.placeholder).toBeNull();
  });

  test("clearing every field deletes all rows and writes none", () => {
    const { deletes, writes } = plan({
      existing: [
        { $id: "row-1", field_key: "row-1" },
        { $id: "row-2", field_key: "row-2" },
      ],
      requested: [],
    });

    expect(deletes).toEqual(["row-1", "row-2"]);
    expect(writes).toEqual([]);
  });
});
