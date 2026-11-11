import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ listRows: vi.fn() }));
const locale = vi.hoisted(() => ({ current: "no" }));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db })),
}));

vi.mock("@/app/actions/locale", () => ({
  getLocale: vi.fn(async () => locale.current),
}));

import { findNearbyDepartmentEvents } from "./expense-events-match";

const row = (
  id: string,
  startDate: string,
  titles: Partial<Record<"en" | "no", string>>
) => ({
  $id: id,
  start_date: startDate,
  translation_refs: Object.entries(titles).map(([refLocale, title]) => ({
    locale: refLocale,
    title,
  })),
});

const queriesOf = (call: number): string[] =>
  db.listRows.mock.calls[call][2].map(String);

describe("findNearbyDepartmentEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locale.current = "no";
  });

  it("returns at most three published events within seven days, nearest first", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        row("far", "2026-11-20T18:00:00.000Z", { no: "For langt unna" }),
        row("two-days", "2026-11-07T18:00:00.000Z", {
          en: "Board dinner",
          no: "Styremiddag",
        }),
        row("same-day", "2026-11-05T17:00:00.000Z", { no: "Julebord" }),
        row("english-only", "2026-11-04T17:00:00.000Z", {
          en: "Career day",
        }),
        row("six-days", "2026-11-11T09:00:00.000Z", { no: "Fagdag" }),
      ],
      total: 5,
    });

    const result = await findNearbyDepartmentEvents({
      departmentId: "dept-1",
      dates: ["2026-11-05"],
    });

    expect(result).toEqual({
      success: true,
      data: [
        {
          id: "same-day",
          startDate: "2026-11-05T17:00:00.000Z",
          title: "Julebord",
        },
        {
          id: "english-only",
          startDate: "2026-11-04T17:00:00.000Z",
          title: "Career day",
        },
        {
          id: "two-days",
          startDate: "2026-11-07T18:00:00.000Z",
          title: "Styremiddag",
        },
      ],
    });

    const serialized = queriesOf(0).join("|");
    expect(serialized).toContain(
      '"method":"equal","attribute":"status","values":["published"]'
    );
    expect(serialized).toContain(
      '"method":"equal","attribute":"department_id","values":["dept-1"]'
    );
    expect(serialized).toContain('"attribute":"start_date"');
  });

  it("returns success false on error", async () => {
    db.listRows.mockRejectedValue(new Error("Appwrite down"));

    const result = await findNearbyDepartmentEvents({
      departmentId: "dept-1",
      dates: ["2026-11-05"],
    });

    expect(result.success).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(result.data).toBeUndefined();
  });

  it("does not read events without a valid receipt date", async () => {
    const result = await findNearbyDepartmentEvents({
      departmentId: "dept-1",
      dates: ["", "not a date"],
    });

    expect(result).toEqual({ success: true, data: [] });
    expect(db.listRows).not.toHaveBeenCalled();
  });

  it("refuses a missing department", async () => {
    const result = await findNearbyDepartmentEvents({
      departmentId: "",
      dates: ["2026-11-05"],
    });

    expect(result.success).toBe(false);
    expect(db.listRows).not.toHaveBeenCalled();
  });
});
