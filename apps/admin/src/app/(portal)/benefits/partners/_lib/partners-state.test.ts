import { describe, expect, it } from "bun:test";
import type {
  PartnerDeal,
  PartnerWithDeals,
} from "../../../_actions/benefit-partners";
import type { SiteLogo, SiteLogoGroup } from "../../../_actions/site-logos";
import {
  buildPartnerCards,
  moveLogo,
  publishedDealCount,
} from "./partners-state";

const NOW = new Date("2026-06-01T00:00:00Z");

const deal = (id: string, over: Partial<PartnerDeal> = {}): PartnerDeal => ({
  $id: id,
  campus_id: "oslo",
  partner_id: "p",
  publish_end: null,
  publish_start: null,
  section: "member",
  status: "published",
  title_en: id,
  title_nb: id,
  ...over,
});

const partner = (
  id: string,
  over: Partial<PartnerWithDeals> = {}
): PartnerWithDeals => ({
  campus_id: "oslo",
  deals: [],
  description_en: null,
  description_nb: null,
  editable: true,
  id,
  is_active: true,
  logo_url: null,
  name: id,
  website_url: null,
  ...over,
});

const all = { campusId: "all", showEnded: false } as const;

describe("buildPartnerCards", () => {
  it("filters by campus", () => {
    const ps = [partner("a"), partner("b", { campus_id: "bergen" })];
    expect(
      buildPartnerCards(ps, { campusId: "bergen", showEnded: false }, NOW).map(
        (c) => c.partner.id
      )
    ).toEqual(["b"]);
    expect(buildPartnerCards(ps, all, NOW)).toHaveLength(2);
  });

  it("hides ended partners unless showEnded", () => {
    const ps = [partner("a"), partner("b", { is_active: false })];
    expect(buildPartnerCards(ps, all, NOW).map((c) => c.partner.id)).toEqual([
      "a",
    ]);
    const cards = buildPartnerCards(ps, { ...all, showEnded: true }, NOW);
    expect(cards.map((c) => [c.partner.id, c.ended])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });

  it("sorts partners by name and deals by title", () => {
    const ps = [
      partner("z", { name: "Å" }),
      partner("a", {
        deals: [deal("d2", { title_nb: "B" }), deal("d1", { title_nb: "A" })],
        name: "B",
      }),
    ];
    const cards = buildPartnerCards(ps, all, NOW);
    expect(cards.map((c) => c.partner.name)).toEqual(["B", "Å"]);
    expect(cards[0]?.dealStates.map((d) => d.deal.$id)).toEqual(["d1", "d2"]);
  });

  it("marks deals of an ended partner as ended", () => {
    const ps = [partner("a", { deals: [deal("d")], is_active: false })];
    const [card] = buildPartnerCards(ps, { ...all, showEnded: true }, NOW);
    expect(card?.dealStates[0]?.state).toBe("ended");
  });
});

describe("publishedDealCount", () => {
  it("counts only published deals", () => {
    const p = partner("a", {
      deals: [deal("1"), deal("2", { status: "draft" }), deal("3")],
    });
    expect(publishedDealCount(p)).toBe(2);
  });
});

describe("moveLogo", () => {
  const logo = (id: string): SiteLogo => ({
    campus_id: "oslo",
    id,
    image_url: "x",
    name: id,
    sort_order: 0,
    url: null,
  });
  const group: SiteLogoGroup = {
    campusId: "oslo",
    editable: true,
    logos: [logo("a"), logo("b"), logo("c")],
  };

  it("reorders and keeps the other logos", () => {
    const next = moveLogo(group, "a", "c");
    expect(next.logos.map((l) => l.id)).toEqual(["b", "c", "a"]);
    expect(next.campusId).toBe("oslo");
    expect(next.editable).toBe(true);
  });

  it("returns the group unchanged for unknown ids", () => {
    expect(moveLogo(group, "a", "zzz").logos.map((l) => l.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
