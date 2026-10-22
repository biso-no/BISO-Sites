import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations:
    async () =>
    (key: string, values?: { count?: number }): string =>
      values?.count === undefined ? key : `${key}:${values.count}`,
}));

import { MembershipV2 } from "./membership-v2";

const BENEFIT_COUNT = "plans.benefitsLede";

const benefit = (
  id: string,
  overrides: Partial<PublicBenefit> = {}
): PublicBenefit => ({
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
  ...overrides,
});

const render = async (benefits: PublicBenefit[]) =>
  renderToStaticMarkup(
    await MembershipV2({ benefits, campusName: null, locale: "no", plans: [] })
  );

describe("/membership benefits", () => {
  it("leaves out the benefits section when there is nothing to show", async () => {
    // `getPublicBenefits().catch(() => [])` lands here during an outage.
    const html = await render([]);

    expect(html).not.toContain('id="fordeler"');
    expect(html).not.toContain(BENEFIT_COUNT);
  });

  it("counts the member benefits and groups them by category label", async () => {
    const html = await render([benefit("a"), benefit("b")]);

    expect(html).toContain(`${BENEFIT_COUNT}:2`);
    expect(html).toContain("Mat og drikke");
    expect(html).toContain("Tilbud a");
  });

  it("lists the one-line sections without counting them as member benefits", async () => {
    const html = await render([
      benefit("c", { category: null, section: "career" }),
    ]);

    expect(html).toContain('id="fordeler"');
    expect(html).toContain("benefits.categories.career.title");
    expect(html).toContain("Tilbud c");
    expect(html).not.toContain(BENEFIT_COUNT);
  });
});
