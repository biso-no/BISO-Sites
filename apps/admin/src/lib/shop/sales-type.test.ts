import { describe, expect, mock, test } from "bun:test";
import { assertSalesTypeUsable } from "./sales-type";

function fakeDb(getRow: (id: string) => Promise<unknown>) {
  return {
    getRow: mock(
      async (_db: string, _table: string, id: string) => await getRow(id)
    ),
  } as unknown as Parameters<typeof assertSalesTypeUsable>[0];
}

describe("assertSalesTypeUsable", () => {
  test("a draft with no sales type is left alone", async () => {
    const db = fakeDb(() => Promise.reject(new Error("should not be called")));

    await expect(
      assertSalesTypeUsable(db, "draft", null)
    ).resolves.toBeUndefined();
  });

  test("a missing sales type id on a status that goes live is refused", async () => {
    const db = fakeDb(() => Promise.reject(new Error("not queried")));

    await expect(assertSalesTypeUsable(db, "published", null)).rejects.toThrow(
      "Choose an active sales type before publishing"
    );
  });

  test("a deleted sales type is refused", async () => {
    const db = fakeDb(() => Promise.reject(new Error("row not found")));

    await expect(
      assertSalesTypeUsable(db, "published", "sales-type-1")
    ).rejects.toThrow("Choose an active sales type before publishing");
  });

  test("an inactive sales type is refused", async () => {
    const db = fakeDb(() =>
      Promise.resolve({ $id: "sales-type-1", active: false })
    );

    await expect(
      assertSalesTypeUsable(db, "pending_approval", "sales-type-1")
    ).rejects.toThrow("Choose an active sales type before publishing");
  });

  test("an active sales type passes", async () => {
    const db = fakeDb(() =>
      Promise.resolve({ $id: "sales-type-1", active: true })
    );

    await expect(
      assertSalesTypeUsable(db, "published", "sales-type-1")
    ).resolves.toBeUndefined();
  });
});
