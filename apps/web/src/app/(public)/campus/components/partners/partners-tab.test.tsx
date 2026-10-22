import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CampusLogo } from "@/lib/data/benefits";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children }: { children: ReactNode }) =>
      createElement("div", null, children),
  },
}));

import { PartnersTab } from "./partners-tab";

const logo = (overrides: Partial<CampusLogo>): CampusLogo => ({
  campusId: "2",
  id: "l1",
  imageUrl: "https://cdn.example.com/acme.png",
  name: "Acme AS",
  url: "https://acme.example.com",
  ...overrides,
});

const businessBenefit = (title: string): PublicBenefit => ({
  campusId: "5",
  category: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  description: { en: null, nb: null },
  id: title,
  imageUrl: null,
  isFeatured: false,
  partner: null,
  publishEnd: null,
  redemptionType: "none",
  section: "business",
  sortOrder: 0,
  terms: { en: null, nb: null },
  title: { en: title, nb: title },
});

const render = (props: {
  benefits?: PublicBenefit[];
  campusId?: string | null;
  campusLogos?: CampusLogo[];
}) =>
  renderToStaticMarkup(
    createElement(PartnersTab, {
      benefits: props.benefits ?? [],
      campusId: props.campusId ?? "2",
      campusLogos: props.campusLogos ?? [],
      campusName: "Bergen",
      locale: "no",
    })
  );

describe("PartnersTab", () => {
  it("renders campus logos even when there are no business items", () => {
    const html = render({ campusLogos: [logo({})] });
    expect(html).toContain('alt="Acme AS"');
    expect(html).toContain('href="https://acme.example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('href="/contact"');
  });

  it("does not link a logo that has no url", () => {
    const html = render({ campusLogos: [logo({ url: null })] });
    expect(html).toContain('alt="Acme AS"');
    expect(html).not.toContain("noopener");
  });

  it("only shows logos for the active campus", () => {
    const html = render({
      campusLogos: [logo({}), logo({ campusId: "3", id: "l2", name: "Other" })],
    });
    expect(html).toContain('alt="Acme AS"');
    expect(html).not.toContain('alt="Other"');
  });

  it("lists business benefits from the table", () => {
    expect(
      render({ benefits: [businessBenefit("Stand at campus")] })
    ).toContain("Stand at campus");
  });

  it("shows a calm note and the CTA when there is nothing else", () => {
    const html = render({});
    expect(html).toContain("Ingen partnerskapsinformasjon");
    expect(html).toContain('href="/contact"');
  });
});
