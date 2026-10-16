import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";

const db = { listRows: mock() };

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ({ roles: ["campusadmin"] })),
}));

const { listSalesTypeOptions } = await import("./lookups");

const rows = [
  {
    $id: "varesalg",
    account_number: 3000,
    active: true,
    label_en: "Merchandise",
    label_no: "Varesalg",
  },
  {
    $id: "gammel",
    account_number: 3100,
    active: false,
    label_en: "Old",
    label_no: "Gammel",
  },
];

describe("listSalesTypeOptions", () => {
  beforeEach(() => {
    db.listRows.mockReset();
    db.listRows.mockResolvedValue({ rows, total: rows.length });
  });

  test("offers only active sales types by default", async () => {
    await listSalesTypeOptions();

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.equal("active", true));
  });

  test("also returns the product's current sales type when it is inactive, flagged", async () => {
    const options = await listSalesTypeOptions("gammel");

    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(
      Query.or([Query.equal("active", true), Query.equal("$id", "gammel")])
    );
    expect(options).toEqual([
      {
        accountNumber: 3000,
        active: true,
        id: "varesalg",
        labelEn: "Merchandise",
        labelNo: "Varesalg",
      },
      {
        accountNumber: 3100,
        active: false,
        id: "gammel",
        labelEn: "Old",
        labelNo: "Gammel",
      },
    ]);
  });
});
