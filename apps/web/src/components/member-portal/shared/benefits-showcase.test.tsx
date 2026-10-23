import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useLocale: () => "no",
  useTranslations: () => (key: string) => key,
}));

import { BenefitsShowcase } from "./benefits-showcase";

const PARTNER_HEADING = /<h3[^>]*>Peppes<\/h3>/;

const benefit = (overrides: Partial<PublicBenefit> = {}): PublicBenefit => ({
  campusId: "5",
  category: "food_drink",
  createdAt: "2026-01-01T00:00:00.000Z",
  description: { en: null, nb: null },
  id: "benefit-1",
  imageUrl: null,
  isFeatured: false,
  partner: null,
  publishEnd: null,
  redemptionType: "none",
  section: "member",
  sortOrder: 0,
  terms: { en: null, nb: null },
  title: { en: "Pizza deal", nb: "Pizzatilbud" },
  ...overrides,
});

const render = (benefits: PublicBenefit[]) =>
  renderToStaticMarkup(createElement(BenefitsShowcase, { benefits }));

describe("BenefitsShowcase", () => {
  it("leaves out the partner line when a benefit has no partner", () => {
    const html = render([benefit()]);

    expect(html).toContain("Pizzatilbud");
    expect(html).not.toContain("Partner");
  });

  it("names the partner when there is one", () => {
    const html = render([
      benefit({
        partner: { id: "p1", logoUrl: null, name: "Peppes", websiteUrl: null },
      }),
    ]);

    expect(html).toMatch(PARTNER_HEADING);
  });

  it("labels a studio category in the visitor's language", () => {
    const html = render([benefit()]);

    expect(html).toContain("Mat og drikke");
    expect(html).not.toContain("food_drink");
  });

  it("renders nothing while there are no benefits", () => {
    expect(render([])).toBe("");
  });
});
