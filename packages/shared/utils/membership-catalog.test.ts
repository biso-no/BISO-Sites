import { describe, expect, it } from "vitest";
import { toOfferCandidates } from "./membership-offers";

const row = (
  id: string,
  startDate: string,
  expiryDate: string,
  price = 350
) => ({
  $id: id,
  canPurchase: false,
  category: `9${id}`,
  expiryDate,
  membership_id: id,
  name: `plan ${id}`,
  price,
  startDate,
  status: true,
});
const now = new Date("2026-09-29T12:00:00Z");

describe("toOfferCandidates", () => {
  it("keeps plans starting this or next season and tags them", () => {
    const plans = toOfferCandidates(
      [
        row("54", "2026-07-01", "2026-12-31"),
        row("55", "2027-01-01", "2027-06-30"),
        row("53", "2026-01-01", "2026-06-30"),
        row("60", "2029-07-01", "2029-12-31"),
      ],
      now
    );
    expect(plans.map((p) => [p.id, p.offer])).toEqual([
      ["54", "current"],
      ["55", "next"],
    ]);
  });

  it("drops a plan with no price", () => {
    expect(
      toOfferCandidates([row("54", "2026-07-01", "2026-12-31", 0)], now)
    ).toEqual([]);
  });

  it("reads hand-edited DD.MM.YYYY dates", () => {
    expect(
      toOfferCandidates([row("54", "01.07.2026", "31.12.2026")], now).map(
        (p) => p.offer
      )
    ).toEqual(["current"]);
  });
});
