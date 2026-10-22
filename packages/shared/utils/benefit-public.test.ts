import { describe, expect, it } from "vitest";
import {
  BENEFIT_PUBLIC_COLUMNS,
  type BenefitPartnerInput,
  type BenefitRowInput,
  benefitsForCampus,
  countVisibleMemberBenefits,
  publicBenefitsFromRows,
} from "./benefit-public";

const NOW = new Date("2026-06-01T12:00:00Z");

function row(overrides: Partial<BenefitRowInput> = {}): BenefitRowInput {
  return {
    $createdAt: "2026-01-01T00:00:00Z",
    $id: "b1",
    campus_id: "5",
    section: "member",
    sort_order: 0,
    status: "published",
    title_nb: "Tittel",
    title_en: "Title",
    ...overrides,
  };
}

const partner: BenefitPartnerInput = {
  $id: "p1",
  is_active: true,
  logo_url: "https://x/logo.png",
  name: "Partner",
  website_url: "https://x",
};

describe("BENEFIT_PUBLIC_COLUMNS", () => {
  it("never exposes redemption_value", () => {
    expect(BENEFIT_PUBLIC_COLUMNS).not.toContain("redemption_value");
  });
});

describe("publicBenefitsFromRows filtering", () => {
  it("drops drafts", () => {
    expect(publicBenefitsFromRows([row({ status: "draft" })], [], NOW)).toEqual(
      []
    );
  });
  it("drops expired rows", () => {
    const rows = [row({ publish_end: "2026-05-01T00:00:00Z" })];
    expect(publicBenefitsFromRows(rows, [], NOW)).toEqual([]);
  });
  it("drops rows with inactive partner", () => {
    const rows = [row({ partner_id: "p1" })];
    expect(
      publicBenefitsFromRows(rows, [{ ...partner, is_active: false }], NOW)
    ).toEqual([]);
  });
  it("drops rows with unknown partner", () => {
    expect(
      publicBenefitsFromRows([row({ partner_id: "zz" })], [partner], NOW)
    ).toEqual([]);
  });
  it("drops rows without titles", () => {
    const rows = [row({ title_nb: "", title_en: null })];
    expect(publicBenefitsFromRows(rows, [], NOW)).toEqual([]);
  });
});

describe("publicBenefitsFromRows mapping", () => {
  it("maps null section to member and unknown redemption to none", () => {
    const [b] = publicBenefitsFromRows(
      [row({ section: null, redemption_type: "qr" })],
      [],
      NOW
    );
    expect(b?.section).toBe("member");
    expect(b?.redemptionType).toBe("none");
  });
  it("falls back title to other language", () => {
    const [b] = publicBenefitsFromRows([row({ title_en: " " })], [], NOW);
    expect(b?.title).toEqual({ nb: "Tittel", en: "Tittel" });
  });
  it("joins partner and nulls blank strings", () => {
    const [b] = publicBenefitsFromRows(
      [row({ partner_id: "p1", description_nb: "  " })],
      [partner],
      NOW
    );
    expect(b?.partner).toEqual({
      id: "p1",
      logoUrl: "https://x/logo.png",
      name: "Partner",
      websiteUrl: "https://x",
    });
    expect(b?.description.nb).toBeNull();
  });
});

describe("benefitsForCampus", () => {
  const all = publicBenefitsFromRows(
    [
      row({ $id: "n1", campus_id: "5" }),
      row({ $id: "o1", campus_id: "3" }),
      row({ $id: "b1", campus_id: "2", sort_order: 9 }),
      row({ $id: "x1", campus_id: "2", section: "career" }),
    ],
    [],
    NOW
  );
  it("orders campus first and excludes others", () => {
    const ids = benefitsForCampus(all, "2", ["member"]).map((b) => b.id);
    expect(ids).toEqual(["b1", "n1"]);
  });
  it("returns only national for null", () => {
    expect(benefitsForCampus(all, null).map((b) => b.id)).toEqual(["n1"]);
  });
  it("keeps own rows after slice", () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) =>
        row({ $id: `n${i}`, campus_id: "5" })
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        row({ $id: `b${i}`, campus_id: "2" })
      ),
    ];
    const out = benefitsForCampus(
      publicBenefitsFromRows(rows, [], NOW),
      "2"
    ).slice(0, 4);
    expect(out.every((b) => b.campusId === "2")).toBe(true);
  });
});

describe("countVisibleMemberBenefits", () => {
  it("counts member rows for campus plus national", () => {
    const all = publicBenefitsFromRows(
      [
        row({ $id: "a", campus_id: "5" }),
        row({ $id: "b", campus_id: "2" }),
        row({ $id: "c", campus_id: "3" }),
        row({ $id: "d", campus_id: "2", section: "career" }),
      ],
      [],
      NOW
    );
    expect(countVisibleMemberBenefits(all, "2")).toBe(2);
  });
});
