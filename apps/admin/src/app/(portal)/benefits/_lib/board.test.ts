import { describe, expect, it } from "bun:test";
import type { BoardBenefit, BoardPartner } from "../../_actions/benefits";
import {
  type BoardItem,
  buildBoardSections,
  canMoveItem,
  reorderIds,
  reorderOwnItems,
  summarizeBoard,
} from "./board";

const NOW = new Date("2026-10-22T10:00:00Z");

function benefit(overrides: Partial<BoardBenefit> = {}): BoardBenefit {
  return {
    $createdAt: "2026-01-01T00:00:00Z",
    $id: "b1",
    campus_id: "2",
    category: null,
    image_url: null,
    is_featured: false,
    partner_id: null,
    publish_end: null,
    publish_start: null,
    redemption_type: "none",
    section: "member",
    sort_order: 0,
    status: "published",
    title_en: "T",
    title_nb: "T",
    ...overrides,
  };
}

function partner(overrides: Partial<BoardPartner> = {}): BoardPartner {
  return {
    campus_id: null,
    id: "p1",
    is_active: true,
    logo_url: null,
    name: "P",
    ...overrides,
  };
}

describe("buildBoardSections", () => {
  it("returns all five sections in order", () => {
    const sections = buildBoardSections([], [], "2", NOW);
    expect(sections.map((s) => s.section)).toEqual([
      "member",
      "career",
      "social",
      "safety",
      "business",
    ]);
  });

  it("splits own and national, ignoring other campuses", () => {
    const sections = buildBoardSections(
      [
        benefit({ $id: "own", campus_id: "2" }),
        benefit({ $id: "nat", campus_id: "5" }),
        benefit({ $id: "other", campus_id: "1" }),
      ],
      [],
      "2",
      NOW
    );
    expect(sections[0]?.own.map((i) => i.benefit.$id)).toEqual(["own"]);
    expect(sections[0]?.national.map((i) => i.benefit.$id)).toEqual(["nat"]);
  });

  it("puts national rows in own on the national tab", () => {
    const sections = buildBoardSections(
      [benefit({ $id: "nat", campus_id: "5" })],
      [],
      "5",
      NOW
    );
    expect(sections[0]?.national).toEqual([]);
    expect(sections[0]?.own.map((i) => i.benefit.$id)).toEqual(["nat"]);
  });

  it("treats a null section as member", () => {
    const sections = buildBoardSections(
      [benefit({ section: null as unknown as string })],
      [],
      "2",
      NOW
    );
    expect(sections[0]?.own).toHaveLength(1);
  });

  it("sorts expired after draft even with lower sort_order", () => {
    const sections = buildBoardSections(
      [
        benefit({
          $id: "expired",
          publish_end: "2026-01-01T00:00:00Z",
          sort_order: 0,
        }),
        benefit({ $id: "draft", sort_order: 5, status: "draft" }),
      ],
      [],
      "2",
      NOW
    );
    expect(sections[0]?.own.map((i) => i.benefit.$id)).toEqual([
      "draft",
      "expired",
    ]);
  });

  it("orders by sort_order then createdAt", () => {
    const sections = buildBoardSections(
      [
        benefit({ $id: "c", sort_order: 1 }),
        benefit({ $id: "b", $createdAt: "2026-02-01T00:00:00Z" }),
        benefit({ $id: "a" }),
      ],
      [],
      "2",
      NOW
    );
    expect(sections[0]?.own.map((i) => i.benefit.$id)).toEqual(["a", "b", "c"]);
  });

  it("marks a deal with an inactive partner as ended", () => {
    const sections = buildBoardSections(
      [benefit({ partner_id: "p1" })],
      [partner({ is_active: false })],
      "2",
      NOW
    );
    expect(sections[0]?.own[0]?.state).toBe("ended");
    expect(sections[0]?.own[0]?.partner?.id).toBe("p1");
  });
});

describe("summarizeBoard", () => {
  it("counts visible, drafts and ending soon", () => {
    const sections = buildBoardSections(
      [
        benefit({ $id: "soon", publish_end: "2026-11-10T22:59:59Z" }),
        benefit({ $id: "later", publish_end: "2026-12-20T22:59:59Z" }),
        benefit({ $id: "d", status: "draft" }),
      ],
      [],
      "2",
      NOW
    );
    expect(summarizeBoard(sections, NOW)).toEqual({
      drafts: 1,
      endingSoon: 1,
      visible: 2,
    });
  });

  it("does not count national items", () => {
    const sections = buildBoardSections(
      [benefit({ campus_id: "5" })],
      [],
      "2",
      NOW
    );
    expect(summarizeBoard(sections, NOW)).toEqual({
      drafts: 0,
      endingSoon: 0,
      visible: 0,
    });
  });
});

describe("reorderIds", () => {
  it("moves the active id to the over index", () => {
    expect(reorderIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("returns the input for a missing or equal id", () => {
    const ids = ["a", "b"];
    expect(reorderIds(ids, "x", "a")).toBe(ids);
    expect(reorderIds(ids, "a", "x")).toBe(ids);
    expect(reorderIds(ids, "a", "a")).toBe(ids);
  });
});

describe("moving own items", () => {
  const item = (id: string, state: BoardItem["state"]): BoardItem => ({
    benefit: benefit({ $id: id }),
    partner: null,
    state,
  });

  it("only live, planned and draft items can move", () => {
    expect(canMoveItem(item("a", "visible"))).toBe(true);
    expect(canMoveItem(item("a", "scheduled"))).toBe(true);
    expect(canMoveItem(item("a", "draft"))).toBe(true);
    expect(canMoveItem(item("a", "expired"))).toBe(false);
    expect(canMoveItem(item("a", "ended"))).toBe(false);
    expect(canMoveItem(item("a", "hidden"))).toBe(false);
  });

  const own = [
    item("live-1", "visible"),
    item("live-2", "draft"),
    item("old-1", "expired"),
    item("old-2", "hidden"),
  ];

  it("keeps lapsed items at the end of the stored order", () => {
    expect(reorderOwnItems(own, "live-2", "live-1")).toEqual([
      "live-2",
      "live-1",
      "old-1",
      "old-2",
    ]);
  });

  it("changes nothing when a lapsed item is involved", () => {
    expect(reorderOwnItems(own, "live-1", "old-1")).toBeNull();
    expect(reorderOwnItems(own, "old-2", "live-1")).toBeNull();
    expect(reorderOwnItems(own, "live-1", "live-1")).toBeNull();
  });
});
