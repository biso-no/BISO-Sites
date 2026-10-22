import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import { BenefitsSection } from "./student-sections";

const BERGEN = "2";
const BENEFIT_TITLE = /T-[a-z]+\d/g;

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

const render = async (benefits: PublicBenefit[], campusId: string | null) =>
  renderToStaticMarkup(
    await BenefitsSection({
      benefits,
      benefitsHref: "/membership#fordeler",
      campusId,
      campusLabel: "Bergen",
      locale: "no",
    })
  );

describe("/students BenefitsSection", () => {
  it("shows four member titles with the selected campus's first", async () => {
    const html = await render(
      [
        member("nat1", "5", 0),
        member("nat2", "5", 1),
        member("nat3", "5", 2),
        member("nat4", "5", 3),
        member("bergen1", BERGEN, 0),
      ],
      BERGEN
    );
    const shown = html.match(BENEFIT_TITLE) ?? [];

    expect(shown).toHaveLength(4);
    expect(shown[0]).toBe("T-bergen1");
  });

  it("shows only national rows for every campus", async () => {
    const html = await render(
      [member("nat1", "5", 0), member("bergen1", BERGEN, 0)],
      null
    );

    expect(html).toContain("T-nat1");
    expect(html).not.toContain("T-bergen1");
  });

  it("renders nothing while there are no benefits", async () => {
    expect(await render([], BERGEN)).toBe("");
  });
});
