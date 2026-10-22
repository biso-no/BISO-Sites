// @vitest-environment happy-dom
import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => ({ current: "en" }));
const timeZone = vi.hoisted(() => ({ current: "Europe/Oslo" }));
const revealBenefit = vi.hoisted(() => vi.fn());

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useLocale: () => locale.current,
  useTimeZone: () => timeZone.current,
  useTranslations: () => (key: string, values?: { date?: string }) =>
    values?.date ? `${key} ${values.date}` : key,
}));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children }: { children: ReactNode }) =>
      createElement("div", null, children),
  },
}));
vi.mock("@/app/actions/member-portal", () => ({ revealBenefit }));

import { BenefitCard } from "./benefit-card";

const PRE_LINE_PARAGRAPH =
  /<p class="[^"]*whitespace-pre-line[^"]*">Show your member pass.\nWeekdays only.<\/p>/;

const benefit = (overrides: Partial<PublicBenefit>): PublicBenefit => ({
  campusId: "5",
  category: "other",
  createdAt: "2026-01-01T00:00:00.000Z",
  description: { en: null, nb: null },
  id: "benefit-1",
  imageUrl: null,
  isFeatured: false,
  partner: null,
  publishEnd: null,
  redemptionType: "none",
  section: "member",
  sortOrder: 0,
  terms: { en: null, nb: null },
  title: { en: "10% off at the campus café", nb: "10 % rabatt i kantina" },
  ...overrides,
});

const render = (overrides: Partial<PublicBenefit>) =>
  renderToStaticMarkup(
    createElement(BenefitCard, { benefit: benefit(overrides) })
  );

const flush = () => act(() => Promise.resolve());

async function mountAndReveal(overrides: Partial<PublicBenefit>) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => {
    root.render(createElement(BenefitCard, { benefit: benefit(overrides) }));
  });
  const before = container.innerHTML;
  const button = container.querySelector("button");
  await act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush();
  return { after: container.innerHTML, before };
}

describe("BenefitCard", () => {
  beforeEach(() => {
    locale.current = "en";
    timeZone.current = "Europe/Oslo";
    revealBenefit.mockReset();
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("leaves no empty description block for a benefit without a description", () => {
    const html = render({});

    expect(html).toContain("10% off at the campus café");
    expect(html).not.toContain("<article");
  });

  it("renders stored HTML as HTML, not as visible tags", () => {
    const html = render({
      description: {
        en: "<p>Show your member pass.</p><ul><li>Weekdays</li></ul>",
        nb: null,
      },
    });

    expect(html).toContain("<p>Show your member pass.</p>");
    expect(html).toContain("<li>Weekdays</li>");
    expect(html).not.toContain("&lt;p&gt;");
  });

  it("sends a value starting with [ to the Plate renderer, not a text paragraph", () => {
    const html = render({
      description: {
        en: '[{"type":"p","children":[{"text":"Plate copy"}]}]',
        nb: null,
      },
    });

    expect(html).toContain("Plate copy");
    expect(html).not.toContain("whitespace-pre-line");
    expect(html).not.toContain("&quot;type&quot;");
  });

  it("keeps the line breaks of a plain-text description", () => {
    const html = render({
      description: { en: "Show your member pass.\nWeekdays only.", nb: null },
    });

    expect(html).toMatch(PRE_LINE_PARAGRAPH);
  });

  it("shows the Norwegian copy to a Norwegian visitor", () => {
    locale.current = "no";
    const html = render({
      description: { en: null, nb: "<p>Vis medlemskortet.</p>" },
    });

    expect(html).toContain("10 % rabatt i kantina");
    expect(html).toContain("<p>Vis medlemskortet.</p>");
    expect(html).not.toContain("10% off at the campus café");
  });

  it("falls back to the other language instead of a blank heading", () => {
    const html = render({ title: { en: "", nb: "10 % rabatt i kantina" } });

    expect(html).toContain("10 % rabatt i kantina");
  });

  it("labels a studio category in the visitor's language", () => {
    locale.current = "no";
    const html = render({ category: "food_drink" });

    expect(html).toContain("Mat og drikke");
    expect(html).not.toContain("food_drink");
    expect(html).not.toContain("null");
    expect(html).not.toContain("undefined");
  });

  it("shows the Norwegian terms for locale no and the English for en", () => {
    const terms = { en: "Weekdays only", nb: "Kun hverdager" };
    locale.current = "no";
    const norwegian = render({ terms });
    locale.current = "en";
    const english = render({ terms });

    expect(norwegian).toContain("Kun hverdager");
    expect(norwegian).not.toContain("Weekdays only");
    expect(english).toContain("Weekdays only");
  });

  it("formats the end date in the visitor's locale", () => {
    locale.current = "no";
    const html = render({ publishEnd: "2026-12-24T12:00:00.000Z" });

    expect(html).toContain("24. des. 2026");
  });

  it("keeps the British day-month order for an English visitor", () => {
    const html = render({ publishEnd: "2026-12-24T12:00:00.000Z" });

    expect(html).toContain("24 Dec 2026");
  });

  it("formats the end date in next-intl's time zone, not the runtime's", () => {
    // 12:00 UTC is already the next day at UTC+14, whatever the machine's
    // own zone, so the server render and the browser get the same date.
    locale.current = "no";
    timeZone.current = "Pacific/Kiritimati";
    const html = render({ publishEnd: "2026-12-24T12:00:00.000Z" });

    expect(html).toContain("25. des. 2026");
  });

  it("shows the partner name and logo from the partner", () => {
    const html = render({
      partner: {
        id: "p1",
        logoUrl: "https://appwrite.biso.no/logo.png",
        name: "Campus Café",
        websiteUrl: null,
      },
    });

    expect(html).toContain("Campus Café");
    expect(html).toContain("logo.png");
  });

  it("shows the member-card line for an onsite benefit, with no reveal button", () => {
    const html = render({ redemptionType: "onsite" });

    expect(html).toContain("onsite");
    expect(html).not.toContain("<button");
  });

  it("renders no code before reveal", () => {
    const html = render({ redemptionType: "code" });

    expect(html).toContain("reveal");
    expect(html).not.toContain("<code");
  });

  it("shows the value only after revealBenefit returns it", async () => {
    revealBenefit.mockResolvedValue({ success: true, value: "SAVE10" });

    const { after, before } = await mountAndReveal({ redemptionType: "code" });

    expect(before).not.toContain("SAVE10");
    expect(revealBenefit).toHaveBeenCalledWith("benefit-1");
    expect(after).toContain("SAVE10");
  });

  it.each([
    ["not_member", "revealErrors.notMember"],
    ["unavailable", "revealErrors.unavailable"],
    ["no_code", "revealErrors.noCode"],
    ["not_found", "revealErrors.generic"],
  ])("shows a friendly message for %s", async (reason, key) => {
    revealBenefit.mockResolvedValue({ success: false, reason });

    const { after } = await mountAndReveal({ redemptionType: "link" });

    expect(after).toContain(key);
    expect(after).not.toContain("not_found");
    expect(after).not.toContain("no_code");
  });

  it("shows the generic message when the reveal call throws", async () => {
    revealBenefit.mockRejectedValue(new Error("network"));

    const { after } = await mountAndReveal({ redemptionType: "code" });

    expect(after).toContain("revealErrors.generic");
  });
});
