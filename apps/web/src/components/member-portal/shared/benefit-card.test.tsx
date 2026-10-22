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

const PRE_LINE_PARAGRAPH =
  /<p class="[^"]*whitespace-pre-line[^"]*">Show your member pass.\nWeekdays only.<\/p>/;

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

  it("keeps the line breaks of a plain-text description", () => {
    // The admin panel saves descriptions as plain text with line breaks.
    const html = render({
      description_en: "Show your member pass.\nWeekdays only.",
    });

    expect(html).toMatch(PRE_LINE_PARAGRAPH);
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

  it("renders a migrated row without null text and with a readable category", () => {
    // Migrated member rows have no description, teaser or partner name, and
    // a studio category key instead of a legacy label.
    locale.current = "no";
    const html = render({
      category: "food_drink",
      description_en: null,
      description_nb: null,
      teaser_en: null,
      teaser_nb: null,
    } as unknown as Partial<CampusBenefits>);

    expect(html).toContain("10 % rabatt i kantina");
    expect(html).toContain("Mat og drikke");
    expect(html).not.toContain("food_drink");
    expect(html).not.toContain("null");
    expect(html).not.toContain("undefined");
  });

  it("labels a studio category in English for an English visitor", () => {
    expect(render({ category: "other" })).toContain("Other");
  });

  it("keeps a legacy category label as stored", () => {
    expect(render({})).toContain("Lifestyle");
  });
});
