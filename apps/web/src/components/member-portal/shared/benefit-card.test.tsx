import type { CampusBenefits } from "@repo/api/types/appwrite";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children }: { children: ReactNode }) =>
      createElement("div", null, children),
  },
}));
vi.mock("@/app/actions/member-portal", () => ({ revealBenefit: vi.fn() }));

import { BenefitCard } from "./benefit-card";

const benefit = (overrides: Partial<CampusBenefits>): CampusBenefits =>
  ({
    $id: "benefit-1",
    category: "Lifestyle",
    description_en: "",
    description_nb: "",
    image_url: null,
    partner_name: null,
    redemption_type: "none",
    redemption_value: null,
    title_en: "10% off at the campus café",
    title_nb: "10 % rabatt i kantina",
    ...overrides,
  }) as CampusBenefits;

const DESCRIPTION_PARAGRAPH = /<p class="mb-5[^"]*">/;

describe("BenefitCard", () => {
  it("leaves no empty paragraph for a benefit without a description", () => {
    const html = renderToStaticMarkup(
      createElement(BenefitCard, { benefit: benefit({}), isRevealed: false })
    );

    expect(html).toContain("10% off at the campus café");
    expect(html).not.toMatch(DESCRIPTION_PARAGRAPH);
  });

  it("shows the description when there is one", () => {
    const html = renderToStaticMarkup(
      createElement(BenefitCard, {
        benefit: benefit({ description_en: "Show your member pass." }),
        isRevealed: false,
      })
    );

    expect(html).toMatch(DESCRIPTION_PARAGRAPH);
    expect(html).toContain("Show your member pass.");
  });
});
