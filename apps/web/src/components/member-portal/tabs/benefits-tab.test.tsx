// @vitest-environment happy-dom
import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => ({ current: "no" }));

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useLocale: () => locale.current,
  useTimeZone: () => "Europe/Oslo",
  useTranslations: () => (key: string) => key,
}));
vi.mock("motion/react", () => {
  const passthrough = ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children);
  return {
    AnimatePresence: ({ children }: { children?: ReactNode }) => children,
    motion: { div: passthrough },
  };
});
vi.mock("@repo/ui/components/ui/tabs", () => ({
  TabsContent: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
}));
vi.mock("@/app/actions/member-portal", () => ({ revealBenefit: vi.fn() }));
vi.mock("../shared/membership-cta-section", () => ({
  MembershipCtaSection: () => null,
}));

import { BenefitsTab } from "./benefits-tab";

const benefit = (
  id: string,
  category: string,
  title: string
): PublicBenefit => ({
  campusId: "5",
  category,
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
  title: { en: title, nb: title },
});

const benefits = [
  benefit("a", "food_drink", "Pizza deal"),
  benefit("b", "travel", "Train deal"),
];

async function mount({
  isMember = true,
  shown = benefits,
}: {
  isMember?: boolean;
  shown?: PublicBenefit[];
} = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => {
    createRoot(container).render(
      createElement(BenefitsTab, {
        benefits: shown,
        hasBIIdentity: true,
        isMember,
      })
    );
  });
  return container;
}

const chip = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(label)
  );

describe("member benefits category chips", () => {
  beforeEach(() => {
    locale.current = "no";
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("renders a chip per present category and none for absent ones", async () => {
    const container = await mount();

    expect(chip(container, "Mat og drikke")).toBeDefined();
    expect(chip(container, "Reise")).toBeDefined();
    expect(chip(container, "Uteliv")).toBeUndefined();
  });

  it("filters the grid on the category key", async () => {
    const container = await mount();
    expect(container.textContent).toContain("Train deal");

    await act(() => {
      chip(container, "Mat og drikke")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(container.textContent).toContain("Pizza deal");
    expect(container.textContent).not.toContain("Train deal");
  });
});

describe("non-member benefit previews", () => {
  beforeEach(() => {
    locale.current = "no";
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it("leaves out the partner line when a benefit has no partner", async () => {
    const container = await mount({ isMember: false });

    expect(container.textContent).toContain("Pizza deal");
    expect(container.textContent).not.toContain("Partner");
    expect(container.querySelector("h3")?.textContent).toBe("Pizza deal");
  });

  it("names the partner when there is one", async () => {
    const container = await mount({
      isMember: false,
      shown: [
        {
          ...benefit("a", "food_drink", "Pizza deal"),
          partner: {
            id: "p1",
            logoUrl: null,
            name: "Peppes",
            websiteUrl: null,
          },
        },
      ],
    });

    expect(container.querySelector("h3")?.textContent).toBe("Peppes");
  });
});
