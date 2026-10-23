// @vitest-environment happy-dom
import { act, createElement, isValidElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const plans = vi.hoisted(() => [
  { duration: "semester", id: "p1", price: 350 },
]);
const savedItems = vi.hoisted(() => ({
  current: null as { body: string | null; title: string }[] | null,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `i18n:${key}`,
  useFormatter: () => ({ dateTime: () => "" }),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => `i18n:${key}`,
}));
// The welcome flow slides between steps; render each step straight away.
const motionProxy = vi.hoisted(
  () =>
    new Proxy(
      {},
      {
        get:
          (_target, tag: string) =>
          ({ children }: { children?: unknown }) =>
            createElement(tag, null, children as ReactNode),
      }
    )
);
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
  motion: motionProxy,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/bi-sign-in-client", () => ({
  clearBrowserAppwriteSession: vi.fn(),
}));
vi.mock("@/lib/server", () => ({ switchToBiSignIn: vi.fn() }));
vi.mock("@/lib/actions/user", () => ({ updateProfile: vi.fn() }));
vi.mock("@/app/actions/locale", () => ({ getLocale: async () => "no" }));
vi.mock("@/app/actions/membership", () => ({
  getMembershipPlansForPurchase: vi.fn(async () => plans),
}));
vi.mock("@/lib/data/membership-texts", () => ({
  getMembershipTextItems: async () => savedItems.current,
}));
vi.mock("@/lib/data/units", () => ({ cachedPublicUnits: async () => [] }));
vi.mock("@/components/membership/plan-card", () => ({
  MembershipPlanCard: ({ benefits }: { benefits?: string[] }) =>
    createElement(
      "ul",
      null,
      (benefits ?? []).map((benefit) =>
        createElement("li", { key: benefit }, benefit)
      )
    ),
}));

import PartnerPage from "@/app/(public)/business/page";
import BusinessHotspotPage from "@/app/(public)/business-hotspot/page";
import { MembershipBand } from "@/components/home/v2/membership-band";
import { LockedMembershipPanel } from "@/components/member-portal/shared/locked-membership-panel";
import { MembershipCtaSection } from "@/components/member-portal/shared/membership-cta-section";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { MemberCalloutClient } from "@/components/shop/member-callout-client";

const items = [
  { body: null, title: "Saved line one" },
  { body: null, title: "Saved line two" },
];

/**
 * Every string in an element tree, without rendering it. The server pages
 * build their lists in their own body, so the text is in the props they
 * return; nested components (headers, sections) are never called.
 */
function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join(" ");
  }
  if (isValidElement(node)) {
    const props = node.props as Record<string, unknown>;
    return Object.values(props).map(textOf).join(" ");
  }
  return "";
}

async function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => {
    createRoot(container).render(node);
    await Promise.resolve();
  });
  return container;
}

beforeEach(() => {
  document.body.innerHTML = "";
  savedItems.current = null;
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  });
});

describe("membership text spots", () => {
  it("home_join: items replace the i18n lines, null keeps them", async () => {
    const withItems = textOf(await MembershipBand({ items }));
    expect(withItems).toContain("Saved line one");
    expect(withItems).not.toContain("i18n:benefits.categories.social.global");

    const fallback = textOf(await MembershipBand({ items: null }));
    expect(fallback).toContain("i18n:benefits.categories.social.global");
    expect(fallback).not.toContain("Saved line one");
  });

  it("plan_card: items replace the i18n lines, null keeps them", async () => {
    const withItems = await mount(
      createElement(MembershipCtaSection, { items })
    );
    expect(withItems.textContent).toContain("Saved line two");
    expect(withItems.textContent).not.toContain("i18n:benefits.discounts");

    const fallback = await mount(
      createElement(MembershipCtaSection, { items: null })
    );
    expect(fallback.textContent).toContain("i18n:benefits.discounts");
  });

  for (const hasBIIdentity of [true, false]) {
    it(`portal_locked: items replace the i18n lines (hasBIIdentity=${hasBIIdentity})`, async () => {
      const withItems = await mount(
        <LockedMembershipPanel
          hasBIIdentity={hasBIIdentity}
          items={items}
          plans={[]}
        />
      );
      expect(withItems.textContent).toContain("Saved line one");
      expect(withItems.textContent).not.toContain(
        "i18n:locked.quickBenefits.discounts"
      );

      const fallback = await mount(
        <LockedMembershipPanel
          hasBIIdentity={hasBIIdentity}
          items={null}
          plans={[]}
        />
      );
      expect(fallback.textContent).toContain(
        "i18n:locked.quickBenefits.discounts"
      );
    });
  }

  it("onboarding: items replace the i18n lines, null keeps them", async () => {
    const open = async (value: typeof items | null) => {
      localStorage.removeItem("biso_onboarding_state");
      document.body.innerHTML = "";
      const container = await mount(
        createElement(OnboardingFlow, {
          initialName: "",
          items: value,
          linkedBi: false,
          required: false,
        })
      );
      const buttons = [...container.querySelectorAll("button")];
      await act(async () => {
        buttons[0].click();
        await Promise.resolve();
      });
      const next = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("nav.continue")
      );
      await act(async () => {
        next?.click();
        await Promise.resolve();
      });
      return container;
    };
    const withItems = await open(items);
    expect(withItems.textContent).toContain("Saved line one");
    expect(withItems.textContent).not.toContain("i18n:student.benefits.sso");

    const fallback = await open(null);
    expect(fallback.textContent).toContain("i18n:student.benefits.sso");
  });

  it("shop_callout: items replace the i18n lines, null keeps them", async () => {
    const withItems = await mount(
      createElement(MemberCalloutClient, { items })
    );
    expect(withItems.textContent).toContain("Saved line one");
    expect(withItems.textContent).not.toContain("i18n:member.benefitDiscounts");

    const fallback = await mount(
      createElement(MemberCalloutClient, { items: null })
    );
    expect(fallback.textContent).toContain("i18n:member.benefitDiscounts");
  });

  it("business: title + body cards, body optional, null keeps i18n", async () => {
    savedItems.current = [
      { body: "Saved body", title: "Saved title" },
      { body: null, title: "Title only" },
    ];
    const withItems = textOf(await PartnerPage());
    expect(withItems).toContain("Saved title");
    expect(withItems).toContain("Saved body");
    expect(withItems).toContain("Title only");
    expect(withItems).not.toContain("i18n:benefits.items.colleagues.title");

    savedItems.current = null;
    const fallback = textOf(await PartnerPage());
    expect(fallback).toContain("i18n:benefits.items.colleagues.title");
  });

  it("business_hotspot: items replace the i18n lines, null keeps them", async () => {
    savedItems.current = items;
    const withItems = textOf(await BusinessHotspotPage());
    expect(withItems).toContain("Saved line one");
    expect(withItems).not.toContain("i18n:benefits.access");

    savedItems.current = null;
    const fallback = textOf(await BusinessHotspotPage());
    expect(fallback).toContain("i18n:benefits.access");
  });
});
