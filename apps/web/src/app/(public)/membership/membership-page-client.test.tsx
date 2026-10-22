import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (key: string, values?: { count?: number }): string =>
      values?.count === undefined ? key : `${key}:${values.count}`,
}));
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children }: { children?: ReactNode }) =>
      createElement("div", null, children),
  },
}));
vi.mock("@repo/ui/components/image", () => ({
  ImageWithFallback: () => null,
}));
vi.mock("@/components/context/campus", () => ({
  useCampus: () => ({
    activeCampus: undefined,
    activeCampusId: null,
    campuses: [],
    selectCampus: vi.fn(),
  }),
}));

import { MembershipPageClient } from "./membership-page-client";

const PARTNERS_PILL = "hero.stats.partners";

const memberBenefit = (id: string): PublicBenefit => ({
  campusId: "5",
  category: "food_drink",
  createdAt: "2026-01-01T00:00:00.000Z",
  description: { en: null, nb: null },
  id,
  imageUrl: null,
  isFeatured: false,
  partner: null,
  publishEnd: null,
  redemptionType: "none",
  section: "member",
  sortOrder: 0,
  terms: { en: null, nb: null },
  title: { en: `Deal ${id}`, nb: `Tilbud ${id}` },
});

const render = (benefits: PublicBenefit[]) =>
  renderToStaticMarkup(
    createElement(MembershipPageClient, {
      benefits,
      campusData: [],
      locale: "no",
    })
  );

describe("/membership hero stats", () => {
  it("leaves out the benefit count when there are no benefits to count", () => {
    // `getPublicBenefits().catch(() => [])` lands here during an outage.
    const html = render([]);

    expect(html).not.toContain(PARTNERS_PILL);
    expect(html).toContain("hero.stats.card");
    expect(html).toContain("hero.stats.members");
  });

  it("shows the benefit count when there are benefits", () => {
    const html = render([memberBenefit("a"), memberBenefit("b")]);

    expect(html).toContain(`${PARTNERS_PILL}:2`);
  });
});
