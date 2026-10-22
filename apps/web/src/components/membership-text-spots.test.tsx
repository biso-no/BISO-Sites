// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const plans = vi.hoisted(() => [
  { duration: "semester", id: "p1", price: 350 },
]);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `i18n:${key}`,
}));
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
vi.mock("motion/react", () => ({ motion: motionProxy }));
vi.mock("framer-motion", () => ({
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
vi.mock("@/app/actions/membership", () => ({
  getMembershipPlansForPurchase: vi.fn(async () => plans),
}));
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

import { BusinessPageClient } from "@/app/(public)/business/business-page-client";
import { BusinessHotspotClient } from "@/app/(public)/business-hotspot/business-hotspot-client";
import { JoinUs } from "@/components/home/join-us";
import { LockedContentOverlay } from "@/components/member-portal/shared/locked-content-overlay";
import { MembershipCtaSection } from "@/components/member-portal/shared/membership-cta-section";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { MemberCalloutClient } from "@/components/shop/member-callout-client";

const items = [
  { body: null, title: "Saved line one" },
  { body: null, title: "Saved line two" },
];

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
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, value),
  });
});

describe("membership text spots", () => {
  it("home_join: items replace the i18n lines, null keeps them", async () => {
    const withItems = await mount(createElement(JoinUs, { items }));
    expect(withItems.textContent).toContain("Saved line one");
    expect(withItems.textContent).not.toContain(
      "i18n:benefits.categories.social.global"
    );
    const fallback = await mount(createElement(JoinUs, { items: null }));
    expect(fallback.textContent).toContain(
      "i18n:benefits.categories.social.global"
    );
    expect(fallback.textContent).not.toContain("Saved line one");
  });

  it("plan_card: items replace the i18n lines, null keeps them", async () => {
    const withItems = await mount(
      createElement(MembershipCtaSection, { items })
    );
    expect(withItems.textContent).toContain("Saved line two");
    expect(withItems.textContent).not.toContain("i18n:cta.benefits.discounts");
    const fallback = await mount(
      createElement(MembershipCtaSection, { items: null })
    );
    expect(fallback.textContent).toContain("i18n:cta.benefits.discounts");
  });

  for (const hasBIIdentity of [true, false]) {
    it(`portal_locked: items replace the i18n lines (hasBIIdentity=${hasBIIdentity})`, async () => {
      const withItems = await mount(
        <LockedContentOverlay hasBIIdentity={hasBIIdentity} items={items}>
          child
        </LockedContentOverlay>
      );
      expect(withItems.textContent).toContain("Saved line one");
      expect(withItems.textContent).not.toContain(
        "i18n:locked.quickBenefits.discounts"
      );
      const fallback = await mount(
        <LockedContentOverlay hasBIIdentity={hasBIIdentity} items={null}>
          child
        </LockedContentOverlay>
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
    const cards = [
      { body: "Saved body", title: "Saved title" },
      { body: null, title: "Title only" },
    ];
    const props = {
      activeCampus: null,
      careerDaysLinks: {
        bergen: "/b",
        oslo: "/o",
        stavanger: "/s",
        trondheim: "/t",
      },
    };
    const withItems = await mount(
      createElement(BusinessPageClient, { ...props, items: cards })
    );
    expect(withItems.textContent).toContain("Saved title");
    expect(withItems.textContent).toContain("Saved body");
    expect(withItems.textContent).toContain("Title only");
    expect(withItems.textContent).not.toContain(
      "i18n:benefits.items.colleagues.title"
    );
    const fallback = await mount(
      createElement(BusinessPageClient, { ...props, items: null })
    );
    expect(fallback.textContent).toContain(
      "i18n:benefits.items.colleagues.title"
    );
  });

  it("business_hotspot: items replace the i18n lines, null keeps them", async () => {
    const withItems = await mount(
      createElement(BusinessHotspotClient, { items })
    );
    expect(withItems.textContent).toContain("Saved line one");
    expect(withItems.textContent).not.toContain("i18n:benefits.access");
    const fallback = await mount(
      createElement(BusinessHotspotClient, { items: null })
    );
    expect(fallback.textContent).toContain("i18n:benefits.access");
  });
});
