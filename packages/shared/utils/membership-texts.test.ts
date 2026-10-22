import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MEMBERSHIP_TEXT_BODY_MAX,
  MEMBERSHIP_TEXT_MAX_ITEMS,
  MEMBERSHIP_TEXT_SPOT_META,
  MEMBERSHIP_TEXT_SPOTS,
  MEMBERSHIP_TEXT_TITLE_MAX,
  type MembershipTextSpot,
  membershipTextItems,
  membershipTextRowId,
  resolveDefaultItems,
} from "./membership-texts";

const row = (
  spot: string,
  title_nb: string,
  extra: Record<string, unknown> = {}
) => ({ spot, title_nb, ...extra });

describe("spot metadata", () => {
  it("lists the seven spots", () => {
    expect([...MEMBERSHIP_TEXT_SPOTS]).toEqual([
      "home_join",
      "plan_card",
      "portal_locked",
      "onboarding",
      "shop_callout",
      "business",
      "business_hotspot",
    ]);
  });

  it("matches the spot table", () => {
    const m = MEMBERSHIP_TEXT_SPOT_META;
    expect(m.home_join.defaults.map((d) => d.title)).toEqual(
      ["social", "career", "student", "safety", "business"].map(
        (k) => `membership.benefits.categories.${k}.global`
      )
    );
    expect(m.plan_card.defaults).toHaveLength(5);
    expect(m.portal_locked.defaults.map((d) => d.title)).toEqual([
      "memberPortal.locked.quickBenefits.discounts",
      "memberPortal.locked.quickBenefits.card",
      "memberPortal.locked.quickBenefits.priority",
      "memberPortal.locked.quickBenefits.career",
    ]);
    expect(m.onboarding.defaults).toHaveLength(3);
    expect(m.shop_callout.defaults.map((d) => d.title)).toEqual([
      "shop.member.benefitDiscounts",
      "shop.member.benefitEvents",
      "shop.member.benefitPriority",
      "shop.member.benefitPartner",
    ]);
    expect(m.business.defaults).toEqual([
      {
        body: "partner.benefits.items.colleagues.description",
        title: "partner.benefits.items.colleagues.title",
      },
      {
        body: "partner.benefits.items.values.description",
        title: "partner.benefits.items.values.title",
      },
      {
        body: "partner.benefits.items.match.description",
        title: "partner.benefits.items.match.title",
      },
    ]);
    expect(m.business_hotspot.defaults).toHaveLength(6);
    expect(m.business.hasBody).toBe(true);
    expect(m.home_join.hasBody).toBe(false);
    expect(m.home_join.path).toBe("/");
    expect(m.business.labelNb).toBe("For bedrifter");
    expect(m.home_join.labelNb).toBe("Forsiden – «Bli med»");
  });

  it("exports the limits", () => {
    expect(MEMBERSHIP_TEXT_MAX_ITEMS).toBe(12);
    expect(MEMBERSHIP_TEXT_TITLE_MAX).toBe(200);
    expect(MEMBERSHIP_TEXT_BODY_MAX).toBe(500);
  });
});

describe("membershipTextItems", () => {
  it("returns null for an empty spot", () => {
    expect(membershipTextItems([], "home_join", "no")).toBeNull();
    expect(
      membershipTextItems([row("plan_card", "x")], "home_join", "no")
    ).toBeNull();
  });

  it("sorts by sort_order, nulls last, stable", () => {
    const rows = [
      row("home_join", "c", { sort_order: null }),
      row("home_join", "b", { sort_order: 2 }),
      row("home_join", "a", { sort_order: 1 }),
      row("home_join", "d"),
    ];
    expect(
      membershipTextItems(rows, "home_join", "no")?.map((i) => i.title)
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("falls back to Norwegian when English is blank", () => {
    const rows = [
      row("home_join", "Nb en", { sort_order: 0, title_en: "  " }),
      row("home_join", "Nb to", { sort_order: 1, title_en: "En two" }),
    ];
    expect(
      membershipTextItems(rows, "home_join", "en")?.map((i) => i.title)
    ).toEqual(["Nb en", "En two"]);
    expect(
      membershipTextItems(rows, "home_join", "no")?.map((i) => i.title)
    ).toEqual(["Nb en", "Nb to"]);
  });

  it("only returns body for spots with a body", () => {
    const r = (spot: string) =>
      row(spot, "T", { body_en: "", body_nb: " Tekst " });
    expect(membershipTextItems([r("business")], "business", "en")).toEqual([
      { body: "Tekst", title: "T" },
    ]);
    expect(membershipTextItems([r("home_join")], "home_join", "no")).toEqual([
      { body: null, title: "T" },
    ]);
  });

  it("trims and skips rows with a blank title", () => {
    const rows = [
      row("home_join", "  ", { sort_order: 0 }),
      row("home_join", " Hei ", { sort_order: 1 }),
    ];
    expect(membershipTextItems(rows, "home_join", "no")).toEqual([
      { body: null, title: "Hei" },
    ]);
  });
});

describe("resolveDefaultItems", () => {
  it("walks dotted paths", () => {
    const messages = {
      onboarding: {
        student: { benefits: { events: "E", membership: "M", sso: "S" } },
      },
    };
    expect(resolveDefaultItems("onboarding", messages)).toEqual([
      { body: null, title: "M" },
      { body: null, title: "E" },
      { body: null, title: "S" },
    ]);
  });

  it("gives title and body for business", () => {
    const item = (n: string) => ({ description: `${n}d`, title: `${n}t` });
    const messages = {
      partner: {
        benefits: {
          items: { colleagues: item("c"), match: item("m"), values: item("v") },
        },
      },
    };
    expect(resolveDefaultItems("business", messages)).toEqual([
      { body: "cd", title: "ct" },
      { body: "vd", title: "vt" },
      { body: "md", title: "mt" },
    ]);
  });

  it("throws naming a missing path", () => {
    expect(() => resolveDefaultItems("onboarding", {})).toThrow(
      "onboarding.student.benefits.membership"
    );
  });
});

describe("membershipTextRowId", () => {
  it("is deterministic", () => {
    expect(membershipTextRowId("home_join", 2)).toBe("home-join-2");
    expect(membershipTextRowId("business_hotspot", 0)).toBe(
      "business-hotspot-0"
    );
  });
});

describe("real i18n defaults", () => {
  const messagesDir = join(import.meta.dirname, "../../i18n/messages");
  for (const locale of ["no", "en"] as const) {
    it(`every default key path exists in ${locale}`, () => {
      const messages: Record<string, unknown> = {};
      const dir = join(messagesDir, locale);
      for (const spot of MEMBERSHIP_TEXT_SPOTS) {
        for (const d of MEMBERSHIP_TEXT_SPOT_META[spot].defaults) {
          const ns = d.title.split(".")[0] as string;
          if (!messages[ns]) {
            messages[ns] = JSON.parse(
              readFileSync(join(dir, `${ns}.json`), "utf8")
            );
          }
        }
      }
      for (const spot of MEMBERSHIP_TEXT_SPOTS as readonly MembershipTextSpot[]) {
        const items = resolveDefaultItems(spot, messages);
        expect(items.length).toBeGreaterThan(0);
        for (const item of items) {
          expect(item.title.trim()).not.toBe("");
          if (MEMBERSHIP_TEXT_SPOT_META[spot].hasBody) {
            expect(item.body?.trim()).toBeTruthy();
          }
        }
      }
    });
  }
});
