import { describe, expect, mock, test } from "bun:test";
import { publishBookableProduct } from "./publish-gate";

/**
 * Mirrors `sales-type.test.ts`'s fake: a `getRow` that branches on table so
 * the same fake can answer both the product read and the sales-type read
 * `assertProductBookable` performs internally.
 */
function fakeDb(rows: Record<string, unknown>) {
  return {
    getRow: mock((_db: string, table: string, id: string) => {
      const row = rows[`${table}/${id}`];
      if (row === undefined) {
        return Promise.reject(
          Object.assign(new Error("Row with the requested ID not found."), {
            code: 404,
            type: "row_not_found",
          })
        );
      }
      return Promise.resolve(row);
    }),
    updateRow: mock(() => Promise.resolve(undefined)),
  };
}

describe("publishBookableProduct", () => {
  test("refuses and does not write when the product has no department", async () => {
    const db = fakeDb({
      "webshop_products/p1": {
        departmentId: null,
        sales_type: "sales-type-1",
      },
      "sales_types/sales-type-1": { $id: "sales-type-1", active: true },
    });

    await expect(publishBookableProduct(db as never, "p1")).rejects.toThrow(
      "Choose a department before publishing"
    );
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("refuses and does not write when the sales type is missing or inactive", async () => {
    const db = fakeDb({
      "webshop_products/p1": { departmentId: "dept-1", sales_type: null },
    });

    await expect(publishBookableProduct(db as never, "p1")).rejects.toThrow(
      "Choose an active sales type before publishing"
    );
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("refuses and does not write when the sales type has been deactivated", async () => {
    const db = fakeDb({
      "webshop_products/p1": {
        departmentId: "dept-1",
        sales_type: "sales-type-1",
      },
      "sales_types/sales-type-1": { $id: "sales-type-1", active: false },
    });

    await expect(publishBookableProduct(db as never, "p1")).rejects.toThrow(
      "Choose an active sales type before publishing"
    );
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("publishes a product with a department and an active sales type", async () => {
    const db = fakeDb({
      "webshop_products/p1": {
        departmentId: "dept-1",
        sales_type: "sales-type-1",
      },
      "sales_types/sales-type-1": { $id: "sales-type-1", active: true },
    });

    await expect(
      publishBookableProduct(db as never, "p1")
    ).resolves.toBeUndefined();
    expect(db.updateRow).toHaveBeenCalledWith("app", "webshop_products", "p1", {
      status: "published",
    });
  });
});
