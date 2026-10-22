import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) =>
      createElement("div", null, children),
  },
}));

import { StudentsTab } from "./students-tab";

const BERGEN = "2";
const NATIONAL = "5";

const benefit = (overrides: Partial<PublicBenefit>): PublicBenefit => ({
  campusId: NATIONAL,
  category: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  description: { en: null, nb: null },
  id: "b",
  imageUrl: null,
  isFeatured: false,
  partner: null,
  publishEnd: null,
  redemptionType: "none",
  section: "member",
  sortOrder: 0,
  terms: { en: null, nb: null },
  title: { en: "National perk", nb: "Nasjonal fordel" },
  ...overrides,
});

const benefits: PublicBenefit[] = [
  benefit({ id: "n1", title: { en: "National perk", nb: "Nasjonal fordel" } }),
  benefit({
    campusId: BERGEN,
    id: "b1",
    title: { en: "Bergen perk", nb: "Bergen-fordel" },
  }),
  benefit({
    id: "c1",
    section: "career",
    title: { en: "CV workshop", nb: "CV-kurs" },
  }),
  benefit({
    campusId: BERGEN,
    id: "bz1",
    section: "business",
    title: { en: "Hidden business", nb: "Skjult bedrift" },
  }),
];

const render = (campusId: string | null, locale: "no" | "en" = "no") =>
  renderToStaticMarkup(
    createElement(StudentsTab, { benefits, campusId, locale })
  );

describe("StudentsTab", () => {
  it("shows only national benefits when all campuses are selected", () => {
    const html = render(null);
    expect(html).toContain("Nasjonal fordel");
    expect(html).toContain("CV-kurs");
    expect(html).not.toContain("Bergen-fordel");
  });

  it("puts the campus's own benefits before national ones", () => {
    const html = render(BERGEN);
    expect(html.indexOf("Bergen-fordel")).toBeGreaterThan(-1);
    expect(html.indexOf("Bergen-fordel")).toBeLessThan(
      html.indexOf("Nasjonal fordel")
    );
  });

  it("titles benefits in the visitor's language", () => {
    expect(render(null, "en")).toContain("National perk");
  });

  it("ends the member card with a link to the member portal", () => {
    const html = render(null);
    expect(html).toContain('href="/member"');
    expect(html).toContain("Se alle tilbud og koder i medlemsportalen");
  });

  it("does not render the business section", () => {
    expect(render(BERGEN)).not.toContain("Skjult bedrift");
  });

  it("shows a calm empty state when there are no benefits", () => {
    const html = renderToStaticMarkup(
      createElement(StudentsTab, { benefits: [], campusId: null, locale: "en" })
    );
    expect(html).toContain("No benefits information available");
    expect(html).not.toContain('href="/member"');
  });
});
