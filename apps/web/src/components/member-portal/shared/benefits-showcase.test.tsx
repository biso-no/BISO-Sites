import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const passthrough = vi.hoisted(
  () =>
    ({ children }: { children?: ReactNode }) =>
      children
);

vi.mock("next-intl", () => ({
  useLocale: () => "no",
  useTranslations: () => (key: string) => key,
}));
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children }: { children?: ReactNode }) =>
      createElement("div", null, children),
  },
}));
vi.mock("@repo/ui/components/ui/carousel", () => ({
  Carousel: passthrough,
  CarouselContent: passthrough,
  CarouselItem: passthrough,
  CarouselNext: () => null,
  CarouselPrevious: () => null,
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
    expect(html).not.toContain("<h3");
  });

  it("names the partner when there is one", () => {
    const html = render([
      benefit({
        partner: { id: "p1", logoUrl: null, name: "Peppes", websiteUrl: null },
      }),
    ]);

    expect(html).toMatch(PARTNER_HEADING);
  });
});
