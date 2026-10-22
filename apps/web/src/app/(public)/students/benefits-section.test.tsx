import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) =>
      createElement("div", null, children),
  },
}));

import { BenefitsSection } from "./students-page-client";

const BERGEN = "2";

const member = (
  id: string,
  campusId: string,
  sortOrder: number
): PublicBenefit => ({
  campusId,
  category: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  description: { en: null, nb: null },
  id,
  imageUrl: null,
  isFeatured: false,
  partner: null,
  publishEnd: null,
  redemptionType: "none",
  section: "member",
  sortOrder,
  terms: { en: null, nb: null },
  title: { en: `T-${id}`, nb: `T-${id}` },
});

describe("/students BenefitsSection", () => {
  it("shows four member titles with the selected campus's first", () => {
    const benefits = [
      member("nat1", "5", 0),
      member("nat2", "5", 1),
      member("nat3", "5", 2),
      member("nat4", "5", 3),
      member("bergen1", BERGEN, 0),
    ];
    const html = renderToStaticMarkup(
      createElement(BenefitsSection, {
        benefits,
        campusId: BERGEN,
        campusLabel: "Bergen",
        locale: "no",
      })
    );
    const shown = html.match(/T-[a-z]+\d/g) ?? [];
    expect(shown).toHaveLength(4);
    expect(shown[0]).toBe("T-bergen1");
  });
});
