import { describe, expect, it } from "vitest";
import {
  type BenefitVisibilityFields,
  benefitDisplayState,
  isBenefitVisible,
  type OrderableBenefit,
  orderBenefitsCampusFirst,
} from "./benefit-visibility";

const now = new Date("2026-10-21T12:00:00Z");

const published = (
  extra: Partial<BenefitVisibilityFields> = {}
): BenefitVisibilityFields => ({ status: "published", ...extra });

describe("benefitDisplayState", () => {
  it("is visible when published with no dates and no partner", () => {
    expect(benefitDisplayState(published(), null, now)).toBe("visible");
    expect(isBenefitVisible(published(), null, now)).toBe(true);
  });

  it("maps statuses", () => {
    expect(benefitDisplayState({ status: "draft" }, null, now)).toBe("draft");
    expect(benefitDisplayState({ status: "archived" }, null, now)).toBe(
      "hidden"
    );
    expect(benefitDisplayState({ status: "weird" }, null, now)).toBe("hidden");
    expect(isBenefitVisible({ status: "draft" }, null, now)).toBe(false);
  });

  it("ends when the partner is inactive or missing", () => {
    const b = published({ partner_id: "p1" });
    expect(benefitDisplayState(b, { is_active: false }, now)).toBe("ended");
    expect(benefitDisplayState(b, null, now)).toBe("ended");
    expect(benefitDisplayState(b, {}, now)).toBe("visible");
  });

  it("is scheduled before publish_start", () => {
    expect(
      benefitDisplayState(
        published({ publish_start: "2026-10-22T00:00:00Z" }),
        null,
        now
      )
    ).toBe("scheduled");
  });

  it("expires at publish_end", () => {
    expect(
      benefitDisplayState(
        published({ publish_end: now.toISOString() }),
        null,
        now
      )
    ).toBe("expired");
    expect(
      benefitDisplayState(
        published({ publish_end: "2026-10-21T12:00:01Z" }),
        null,
        now
      )
    ).toBe("visible");
  });

  it("ignores unparseable dates", () => {
    expect(
      benefitDisplayState(published({ publish_end: "not a date" }), null, now)
    ).toBe("visible");
  });

  it("ended beats scheduled", () => {
    expect(
      benefitDisplayState(
        published({ partner_id: "p1", publish_start: "2026-10-22T00:00:00Z" }),
        { is_active: false },
        now
      )
    ).toBe("ended");
  });
});

describe("orderBenefitsCampusFirst", () => {
  const row = (
    id: string,
    campus_id: string,
    sort_order: number | null,
    $createdAt = "2026-01-01T00:00:00Z"
  ): OrderableBenefit & { id: string } => ({
    id,
    campus_id,
    sort_order,
    $createdAt,
  });

  it("orders campus, then national, then others", () => {
    const rows = [
      row("a", "2", 1),
      row("b", "5", 0),
      row("c", "1", 0),
      row("d", "2", 0),
    ];
    expect(orderBenefitsCampusFirst(rows, "2").map((r) => r.id)).toEqual([
      "d",
      "a",
      "b",
      "c",
    ]);
  });

  it("falls back to $createdAt", () => {
    const rows = [
      row("late", "2", 0, "2026-02-01T00:00:00Z"),
      row("early", "2", null, "2026-01-01T00:00:00Z"),
    ];
    expect(orderBenefitsCampusFirst(rows, "2").map((r) => r.id)).toEqual([
      "early",
      "late",
    ]);
  });

  it("puts national first for null campus", () => {
    const rows = [row("c", "1", 0), row("n", "5", 0)];
    expect(orderBenefitsCampusFirst(rows, null).map((r) => r.id)).toEqual([
      "n",
      "c",
    ]);
  });

  it("does not mutate the input", () => {
    const rows = [row("c", "1", 0), row("n", "5", 0)];
    const copy = [...rows];
    orderBenefitsCampusFirst(rows, null);
    expect(rows).toEqual(copy);
  });
});
