import { describe, expect, it } from "vitest";
import { benefitHeadline, localizedBenefitText } from "./benefit-text";

const BOTH = {
  description_en: "<p>Show your member pass.</p>",
  description_nb: "<p>Vis medlemskortet ditt.</p>",
  teaser_en: "10% off",
  teaser_nb: "10 % rabatt",
  title_en: "Campus café",
  title_nb: "Kantina",
};

describe("localizedBenefitText", () => {
  it("reads the Norwegian fields for a Norwegian visitor", () => {
    expect(localizedBenefitText(BOTH, "no")).toEqual({
      description: "<p>Vis medlemskortet ditt.</p>",
      teaser: "10 % rabatt",
      title: "Kantina",
    });
  });

  it("reads the English fields for an English visitor", () => {
    expect(localizedBenefitText(BOTH, "en").title).toBe("Campus café");
  });

  it("falls back to the other language rather than showing a blank card", () => {
    // Editors may fill in one language only. An English visitor used to get a
    // card with no heading at all for a Norwegian-only benefit.
    const norwegianOnly = {
      ...BOTH,
      description_en: "",
      teaser_en: null,
      title_en: "  ",
    };

    expect(localizedBenefitText(norwegianOnly, "en")).toEqual({
      description: "<p>Vis medlemskortet ditt.</p>",
      teaser: "10 % rabatt",
      title: "Kantina",
    });
  });

  it("leaves the description empty when neither language has one", () => {
    expect(
      localizedBenefitText(
        { ...BOTH, description_en: "", description_nb: "" },
        "no"
      ).description
    ).toBe("");
  });
});

describe("benefitHeadline", () => {
  it("prefers the teaser in the visitor's language", () => {
    expect(benefitHeadline(BOTH, "no")).toBe("10 % rabatt");
  });

  it("uses the title when the benefit has no teaser", () => {
    expect(
      benefitHeadline({ ...BOTH, teaser_en: null, teaser_nb: null }, "no")
    ).toBe("Kantina");
  });
});
