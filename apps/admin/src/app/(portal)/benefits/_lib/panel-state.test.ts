import { describe, expect, it } from "bun:test";
import type { BenefitEditData } from "../../_actions/benefits";
import {
  emptyPanelValues,
  panelFooterActions,
  panelValuesFromBenefit,
  toBenefitFormValues,
  validatePanel,
} from "./panel-state";

function values(overrides: Partial<ReturnType<typeof emptyPanelValues>> = {}) {
  return {
    ...emptyPanelValues("member", "2"),
    titleNb: "Tittel",
    ...overrides,
  };
}

describe("panelFooterActions", () => {
  it("covers new, draft, archived and published", () => {
    expect(panelFooterActions("draft", true)).toEqual(["saveDraft", "publish"]);
    expect(panelFooterActions("draft", false)).toEqual([
      "saveDraft",
      "publish",
      "delete",
    ]);
    expect(panelFooterActions("archived", false)).toEqual([
      "saveDraft",
      "publish",
      "delete",
    ]);
    expect(panelFooterActions("published", false)).toEqual([
      "saveChanges",
      "hide",
      "delete",
    ]);
  });
});

describe("toBenefitFormValues", () => {
  it("keeps published on saveChanges", () => {
    expect(
      toBenefitFormValues(values({ status: "published" }), "saveChanges").status
    ).toBe("published");
  });

  it("maps hide, publish and saveDraft", () => {
    expect(toBenefitFormValues(values(), "hide").status).toBe("archived");
    expect(toBenefitFormValues(values(), "publish").status).toBe("published");
    expect(
      toBenefitFormValues(values({ status: "published" }), "saveDraft").status
    ).toBe("draft");
  });

  it("nulls dates when timing is always", () => {
    const out = toBenefitFormValues(
      values({ endDate: "2026-12-01", startDate: "2026-11-01" }),
      "publish"
    );
    expect(out.publish_start).toBeNull();
    expect(out.publish_end).toBeNull();
  });

  it("sends dates for range timing and nulls blanks", () => {
    const out = toBenefitFormValues(
      values({ endDate: "", startDate: "2026-11-01", timing: "range" }),
      "publish"
    );
    expect(out.publish_start).toBe("2026-11-01");
    expect(out.publish_end).toBeNull();
    expect(out.description_nb).toBeNull();
  });

  it("sends redemption_value only for code and link", () => {
    expect(
      toBenefitFormValues(
        values({ redemptionType: "onsite", redemptionValue: "x" }),
        "publish"
      ).redemption_value
    ).toBeNull();
    expect(
      toBenefitFormValues(
        values({ redemptionType: "code", redemptionValue: "ABC" }),
        "publish"
      ).redemption_value
    ).toBe("ABC");
  });
});

describe("validatePanel", () => {
  it("requires a title", () => {
    expect(validatePanel(values({ titleNb: "" }), "publish").titleNb).toBe(
      "titleRequired"
    );
  });

  it("requires a code or link", () => {
    expect(
      validatePanel(values({ redemptionType: "code" }), "publish")
        .redemptionValue
    ).toBe("codeRequired");
    expect(
      validatePanel(values({ redemptionType: "link" }), "publish")
        .redemptionValue
    ).toBe("linkRequired");
  });

  it("rejects non-https links", () => {
    expect(
      validatePanel(
        values({ redemptionType: "link", redemptionValue: "http://x.no" }),
        "publish"
      ).redemptionValue
    ).toBe("linkInvalid");
  });

  it("skips redemption checks outside member sections", () => {
    expect(
      validatePanel(
        { ...values({ redemptionType: "code" }), section: "career" },
        "publish"
      )
    ).toEqual({});
  });

  it("rejects an end before the start", () => {
    expect(
      validatePanel(
        values({
          endDate: "2026-10-01",
          startDate: "2026-11-01",
          timing: "range",
        }),
        "publish"
      ).endDate
    ).toBe("endBeforeStart");
  });

  it("skips validation for hide", () => {
    expect(validatePanel(values({ titleNb: "" }), "hide")).toEqual({});
  });
});

describe("panelValuesFromBenefit", () => {
  const base: BenefitEditData = {
    $createdAt: "2026-01-01T00:00:00Z",
    $id: "b1",
    campus_id: "2",
    category: null,
    description_en: null,
    description_nb: null,
    editable: true,
    image_url: null,
    is_featured: false,
    partner_id: null,
    publish_end: "2026-11-10T22:59:59Z",
    publish_start: null,
    redemption_type: "code",
    redemption_value: "ABC",
    section: "member",
    sort_order: 0,
    status: "published",
    terms_en: null,
    terms_nb: null,
    title_en: "",
    title_nb: "Tittel",
  };

  it("maps a ranged row with the Oslo end date", () => {
    const out = panelValuesFromBenefit(base);
    expect(out.timing).toBe("range");
    expect(out.endDate).toBe("2026-11-10");
    expect(out.redemptionValue).toBe("ABC");
  });

  it("maps a legacy redemption type to none and null section to member", () => {
    const out = panelValuesFromBenefit({
      ...base,
      redemption_type: "qr",
      section: null as unknown as string,
    });
    expect(out.redemptionType).toBe("none");
    expect(out.section).toBe("member");
  });
});
