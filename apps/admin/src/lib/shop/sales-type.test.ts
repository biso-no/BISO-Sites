import { describe, expect, mock, test } from "bun:test";
import { assertProductBookable } from "./sales-type";

function fakeDb(getRow: (id: string) => Promise<unknown>) {
  return {
    getRow: mock(
      async (_db: string, _table: string, id: string) => await getRow(id)
    ),
  } as unknown as Parameters<typeof assertProductBookable>[0];
}

function notFound(): Error {
  return Object.assign(new Error("Row with the requested ID not found."), {
    code: 404,
    type: "row_not_found",
  });
}

const bookable = { departmentId: "1", salesTypeId: "sales-type-1" };

describe("assertProductBookable", () => {
  test("a draft with no sales type or department is left alone", async () => {
    const db = fakeDb(() => Promise.reject(new Error("should not be called")));

    await expect(
      assertProductBookable(db, "draft", {
        departmentId: null,
        salesTypeId: null,
      })
    ).resolves.toBeUndefined();
  });

  test("a missing sales type id on a status that goes live is refused", async () => {
    const db = fakeDb(() => Promise.reject(new Error("not queried")));

    await expect(
      assertProductBookable(db, "published", { ...bookable, salesTypeId: null })
    ).rejects.toThrow("Choose an active sales type before publishing");
  });

  test("a missing department on a status that goes live is refused", async () => {
    const db = fakeDb(() =>
      Promise.resolve({ $id: "sales-type-1", active: true })
    );

    await expect(
      assertProductBookable(db, "pending_approval", {
        ...bookable,
        departmentId: null,
      })
    ).rejects.toThrow("Choose a department before publishing");
    await expect(
      assertProductBookable(db, "published", { ...bookable, departmentId: "" })
    ).rejects.toThrow("Choose a department before publishing");
  });

  test("a deleted sales type is refused", async () => {
    const db = fakeDb(() => Promise.reject(notFound()));

    await expect(
      assertProductBookable(db, "published", bookable)
    ).rejects.toThrow("Choose an active sales type before publishing");
  });

  test("a lookup failure other than not-found is not disguised as a missing sales type", async () => {
    const db = fakeDb(() =>
      Promise.reject(
        Object.assign(new Error("The current user is not authorized"), {
          code: 401,
          type: "user_unauthorized",
        })
      )
    );

    await expect(
      assertProductBookable(db, "published", bookable)
    ).rejects.toThrow("The current user is not authorized");
  });

  test("an inactive sales type is refused", async () => {
    const db = fakeDb(() =>
      Promise.resolve({ $id: "sales-type-1", active: false })
    );

    await expect(
      assertProductBookable(db, "pending_approval", bookable)
    ).rejects.toThrow("Choose an active sales type before publishing");
  });

  test("an active sales type and a department pass", async () => {
    const db = fakeDb(() =>
      Promise.resolve({ $id: "sales-type-1", active: true })
    );

    await expect(
      assertProductBookable(db, "published", bookable)
    ).resolves.toBeUndefined();
  });
});
