import type { CampusBenefits } from "@repo/api/types/appwrite";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => ({ current: "en" }));

vi.mock("next-intl", () => ({
  useLocale: () => locale.current,
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

const render = (overrides: Partial<CampusBenefits>) =>
  renderToStaticMarkup(
    createElement(BenefitCard, {
      benefit: benefit(overrides),
      isRevealed: false,
    })
  );

describe("BenefitCard", () => {
  beforeEach(() => {
    locale.current = "en";
  });

  it("leaves no empty description block for a benefit without a description", () => {
    const html = render({});

    expect(html).toContain("10% off at the campus café");
    expect(html).not.toContain("<article");
  });

  it("renders the description as HTML, not as visible tags", () => {
    // The admin editor stores HTML. Printed as text, every benefit showed a
    // literal "<p>" to members.
    const html = render({
      description_en: "<p>Show your member pass.</p><ul><li>Weekdays</li></ul>",
    });

    expect(html).toContain("<p>Show your member pass.</p>");
    expect(html).toContain("<li>Weekdays</li>");
    expect(html).not.toContain("&lt;p&gt;");
  });

  it("shows the Norwegian copy to a Norwegian visitor", () => {
    locale.current = "no";
    const html = render({ description_nb: "<p>Vis medlemskortet.</p>" });

    expect(html).toContain("10 % rabatt i kantina");
    expect(html).toContain("<p>Vis medlemskortet.</p>");
    expect(html).not.toContain("10% off at the campus café");
  });

  it("falls back to the other language instead of a blank heading", () => {
    const html = render({ title_en: "" });

    expect(html).toContain("10 % rabatt i kantina");
  });
});
