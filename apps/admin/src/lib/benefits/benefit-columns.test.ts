import { describe, expect, test } from "bun:test";
import { benefitSchema } from "@/app/(portal)/_actions/schemas";
import {
  benefitRowPermissions,
  benefitSecretValue,
  buildBenefitColumns,
  normalizeBenefitValues,
} from "./benefit-columns";

const base = benefitSchema.parse({
  campus_id: "1",
  status: "draft",
  title_nb: "Norsk fordel",
  title_en: "",
});

const partner = { id: "p1", logo_url: "https://x.no/logo.png", name: "Kafe" };

describe("normalizeBenefitValues", () => {
  test("clears member-only fields for other sections", () => {
    const normalized = normalizeBenefitValues({
      ...base,
      category: "food_drink",
      is_featured: true,
      partner_id: "p1",
      redemption_type: "code",
      redemption_value: "ABC",
      section: "career",
    });
    expect(normalized.partner_id).toBeNull();
    expect(normalized.redemption_type).toBe("none");
    expect(normalized.redemption_value).toBeNull();
    expect(normalized.category).toBeNull();
    expect(normalized.is_featured).toBeFalse();
  });
});

describe("buildBenefitColumns", () => {
  test("defaults a member benefit's category to other", () => {
    expect(buildBenefitColumns(base, null, 0).category).toBe("other");
  });

  test("links the partner by id and writes no name or logo copy", () => {
    const columns = buildBenefitColumns(
      { ...base, partner_id: "p1" },
      partner,
      3
    );
    expect(columns.partner_id).toBe("p1");
    expect(columns.partner_name).toBeNull();
    expect(columns.partner_logo_url).toBeNull();
    expect(columns.sort_order).toBe(3);
  });

  test("never copies the code into the public row", () => {
    const columns = buildBenefitColumns(
      { ...base, redemption_type: "code", redemption_value: " ABC " },
      null,
      0
    );
    expect(columns.redemption_value).toBeNull();
  });

  test("falls back to the other language's title", () => {
    const columns = buildBenefitColumns(base, null, 0);
    expect(columns.title_en).toBe("Norsk fordel");
    expect(columns.title_nb).toBe("Norsk fordel");
  });

  test("writes campus, code copy and dates", () => {
    const columns = buildBenefitColumns(
      {
        ...base,
        publish_end: "2026-10-24",
        publish_start: "2026-08-10",
        redemption_type: "code",
        redemption_value: " ABC ",
      },
      null,
      0
    );
    expect(columns.campus).toBe("1");
    expect(columns.campus_id).toBe("1");
    expect(columns.department).toBeNull();
    expect(columns.redemption_value).toBeNull();
    expect(columns.publish_start).toBe("2026-08-09T22:00:00.000Z");
    expect(columns.publish_end).toBe("2026-10-24T21:59:59.000Z");
  });

  test("never writes retired keys", () => {
    const columns = buildBenefitColumns(base, null, 0);
    expect("kind" in columns).toBeFalse();
    expect("teaser_nb" in columns).toBeFalse();
    expect("is_member_only" in columns).toBeFalse();
  });
});

describe("permissions and secrets", () => {
  test("published rows are publicly readable", () => {
    expect(benefitRowPermissions("published")).toEqual(['read("any")']);
    expect(benefitRowPermissions("draft")).toEqual([]);
  });

  test("secret value only for code and link", () => {
    expect(
      benefitSecretValue({
        ...base,
        redemption_type: "link",
        redemption_value: " https://x.no ",
      })
    ).toBe("https://x.no");
    expect(benefitSecretValue({ ...base, redemption_value: "ABC" })).toBeNull();
  });
});
