import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BenefitSummaryCard,
  type BenefitSummaryCardProps,
} from "./benefit-summary-card";

const HTML_DESCRIPTION =
  "<p>Som BISO-medlem får du <strong>redusert pris</strong> på Fadderullan.</p>";
const LOGO_WITHOUT_ALT = /<img alt=""[^>]*logo\.png/;

const benefit = (overrides: Partial<PublicBenefit> = {}): PublicBenefit => ({
  campusId: "2",
  category: "other",
  createdAt: "2026-01-01T00:00:00.000Z",
  description: { en: null, nb: null },
  id: "b1",
  imageUrl: null,
  isFeatured: false,
  partner: null,
  publishEnd: null,
  redemptionType: "code",
  section: "member",
  sortOrder: 0,
  terms: { en: null, nb: null },
  title: { en: "20% at Løft studios", nb: "20 % hos Løft studios" },
  ...overrides,
});

const render = (
  overrides: Partial<PublicBenefit> = {},
  props: Partial<BenefitSummaryCardProps> = {}
) =>
  renderToStaticMarkup(
    <BenefitSummaryCard
      benefit={benefit(overrides)}
      formatValidUntil={(date) => `until ${date}`}
      locale="no"
      {...props}
    />
  );

describe("BenefitSummaryCard", () => {
  it("shows the title in the visitor's language", () => {
    expect(render()).toContain("20 % hos Løft studios");
    expect(render({}, { locale: "en" })).toContain("20% at Løft studios");
  });

  it("flattens a migrated HTML description to text on a summary card", () => {
    const html = render({ description: { en: null, nb: HTML_DESCRIPTION } });

    expect(html).toContain(
      "Som BISO-medlem får du redusert pris på Fadderullan."
    );
    expect(html).not.toContain("<strong>");
    expect(html).toContain("line-clamp-4");
  });

  it("renders the HTML and drops the line cap on a full card", () => {
    const html = render(
      { description: { en: null, nb: HTML_DESCRIPTION } },
      { variant: "full" }
    );

    expect(html).toContain("<strong>redusert pris</strong>");
    expect(html).not.toContain("line-clamp-4");
  });

  it("keeps a studio description's line breaks", () => {
    const html = render({
      description: { en: null, nb: "Vis kortet.\nKun hverdager." },
    });

    expect(html).toContain("whitespace-pre-line");
    expect(html).toContain("Vis kortet.\nKun hverdager.");
  });

  it("leaves no empty paragraph for a benefit without a description", () => {
    const html = render();

    expect(html).not.toContain('text-ink-muted"></p>');
    expect(html.match(/<p/g) ?? []).toHaveLength(0);
  });

  it("names the partner beside a logo that adds nothing for a screen reader", () => {
    const html = render({
      partner: {
        id: "p1",
        logoUrl: "https://appwrite.biso.no/logo.png",
        name: "Løft studios",
        websiteUrl: null,
      },
    });

    expect(html).toContain("Løft studios");
    expect(html).toMatch(LOGO_WITHOUT_ALT);
  });

  it("shows the end date in Oslo time", () => {
    const html = render({ publishEnd: "2026-12-24T23:30:00.000Z" });

    expect(html).toContain("until 25. des. 2026");
  });

  it("shows the image only on a full card", () => {
    const withImage = { imageUrl: "https://appwrite.biso.no/deal.jpg" };

    expect(render(withImage)).not.toContain("deal.jpg");
    expect(render(withImage, { variant: "full" })).toContain("deal.jpg");
  });
});
