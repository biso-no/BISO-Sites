import { STARTING_EXPENSE_COST_TYPES } from "@repo/shared/utils/expense-cost-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db })),
}));

import { getExpenseTypeOptions } from "./expense-types";

const row = (over: Record<string, unknown>) => ({
  $id: "x",
  slug: "a",
  label: "A",
  label_no: null,
  ask_occasion: false,
  account_number: 7140,
  tax_code: 0,
  sort_order: 0,
  active: true,
  ...over,
});

describe("getExpenseTypeOptions", () => {
  beforeEach(() => db.listRows.mockReset());

  it("maps active rows to name-only options sorted by order", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        row({ slug: "c", label: "C", sort_order: 2 }),
        row({
          slug: "b",
          label: "B",
          label_no: "Bé",
          sort_order: 1,
          ask_occasion: true,
        }),
        row({ slug: "z", label: "Z", sort_order: 0, active: false }),
        row({ slug: "a2", label: "Alpha", sort_order: 1 }),
      ],
    });
    expect(await getExpenseTypeOptions()).toEqual([
      { slug: "a2", label: "Alpha", labelNo: null, askOccasion: false },
      { slug: "b", label: "B", labelNo: "Bé", askOccasion: true },
      { slug: "c", label: "C", labelNo: null, askOccasion: false },
    ]);
  });

  it("counts a row without an active value as active, as the api does", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        row({ slug: "unset", label: "Unset", active: null }),
        row({ slug: "off", label: "Off", active: false }),
      ],
    });
    expect(
      (await getExpenseTypeOptions()).map((option) => option.slug)
    ).toEqual(["unset"]);
  });

  it("never includes account numbers", async () => {
    db.listRows.mockResolvedValue({ rows: [row({})] });
    const [option] = await getExpenseTypeOptions();
    expect(Object.keys(option).sort()).toEqual([
      "askOccasion",
      "label",
      "labelNo",
      "slug",
    ]);
  });

  it("falls back to the starting list when empty", async () => {
    db.listRows.mockResolvedValue({ rows: [] });
    const options = await getExpenseTypeOptions();
    expect(options).toHaveLength(STARTING_EXPENSE_COST_TYPES.length);
    expect(options[0]).toEqual({
      slug: STARTING_EXPENSE_COST_TYPES[0].slug,
      label: STARTING_EXPENSE_COST_TYPES[0].label,
      labelNo: STARTING_EXPENSE_COST_TYPES[0].labelNo,
      askOccasion: STARTING_EXPENSE_COST_TYPES[0].askOccasion,
    });
    expect(Object.keys(options[0]).sort()).toEqual([
      "askOccasion",
      "label",
      "labelNo",
      "slug",
    ]);
  });
});
