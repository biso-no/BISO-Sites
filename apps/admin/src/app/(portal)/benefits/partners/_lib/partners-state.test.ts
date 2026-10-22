import { describe, expect, it } from "bun:test";
import type {
  PartnerDeal,
  PartnerWithDeals,
} from "../../../_actions/benefit-partners";
import type { SiteLogo, SiteLogoGroup } from "../../../_actions/site-logos";
import {
  buildPartnerCards,
  emptyPartnersReason,
  moveLogo,
  parsePartnerFilter,
  publishedDealCount,
  visibleDealCount,
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

describe("visibleDealCount", () => {
  it("counts only the deals students can see right now", () => {
    const p = partner("a", {
      deals: [
        deal("live"),
        deal("draft", { status: "draft" }),
        deal("lapsed", { publish_end: "2026-05-01T00:00:00Z" }),
        deal("later", { publish_start: "2026-07-01T00:00:00Z" }),
      ],
    });
    const [card] = buildPartnerCards([p], all, NOW);
    expect(card ? visibleDealCount(card) : -1).toBe(1);
  });
});

describe("parsePartnerFilter", () => {
  const visible = ["2", "5"];

  it("reads a visible campus and the ended switch", () => {
    expect(parsePartnerFilter({ campus: "5", ended: "1" }, visible)).toEqual({
      campusId: "5",
      showEnded: true,
    });
  });

  it("falls back to every partner for a missing or hidden campus", () => {
    expect(parsePartnerFilter({}, visible)).toEqual({
      campusId: "all",
      showEnded: false,
    });
    expect(parsePartnerFilter({ campus: "3", ended: "yes" }, visible)).toEqual({
      campusId: "all",
      showEnded: false,
    });
  });
});

describe("emptyPartnersReason", () => {
  const editable = ["oslo"];

  it("says so when only ended partners are hidden", () => {
    const ps = [partner("a", { is_active: false })];
    expect(emptyPartnersReason(ps, all, editable)).toBe("onlyEnded");
  });

  it("does not suggest adding where the viewer cannot", () => {
    expect(
      emptyPartnersReason([], { campusId: "5", showEnded: false }, editable)
    ).toBe("readOnly");
    expect(emptyPartnersReason([], all, [])).toBe("noAccess");
  });

  it("invites the first partner otherwise", () => {
    expect(emptyPartnersReason([], all, editable)).toBe("noneYet");
    expect(
      emptyPartnersReason(
        [partner("a", { campus_id: "bergen", is_active: false })],
        { campusId: "oslo", showEnded: false },
        editable
      )
    ).toBe("noneYet");
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
