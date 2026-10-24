import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const messages = vi.hoisted(() => ({
  en: {} as Record<string, unknown>,
  no: {} as Record<string, unknown>,
}));

vi.mock("node:fs", async (importOriginal) => importOriginal());
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    let node: unknown = messages.no;
    for (const part of key.split(".")) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    return typeof node === "string" ? node : key;
  },
  useFormatter: () => ({ dateTime: () => "" }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/bi-sign-in-client", () => ({
  clearBrowserAppwriteSession: vi.fn(),
}));
vi.mock("@/lib/server", () => ({ switchToBiSignIn: vi.fn() }));

import { LockedMembershipPanel } from "./locked-membership-panel";

const load = (locale: "en" | "no") =>
  JSON.parse(
    readFileSync(
      new URL(
        `../../../../../../packages/i18n/messages/${locale}/memberPortal.json`,
        import.meta.url
      ),
      "utf8"
    )
  ) as Record<string, unknown>;

messages.no = load("no");
messages.en = load("en");

const NO_BENEFITS = [
  "Eksklusive rabatter hos BISOs partnere",
  "Digitalt medlemskort",
  "Prioritert tilgang til arrangementer",
  "Karriereressurser",
];
const KEYS = ["discounts", "card", "priority", "career"];

describe("LockedMembershipPanel quick benefits", () => {
  for (const hasBIIdentity of [true, false]) {
    it(`renders Norwegian benefit lines (hasBIIdentity=${hasBIIdentity})`, () => {
      const html = renderToStaticMarkup(
        <LockedMembershipPanel hasBIIdentity={hasBIIdentity} plans={[]} />
      );
      for (const line of NO_BENEFITS) {
        expect(html).toContain(line);
      }
    });
  }

  it("shows the saved lines instead of the i18n text", () => {
    const html = renderToStaticMarkup(
      <LockedMembershipPanel
        hasBIIdentity
        items={[{ body: null, title: "Rabatt hos Løft" }]}
        plans={[]}
      />
    );

    expect(html).toContain("Rabatt hos Løft");
    expect(html).not.toContain(NO_BENEFITS[0]);
  });

  it("has every quickBenefits key in both locales", () => {
    for (const locale of ["no", "en"] as const) {
      const group = (
        messages[locale].locked as { quickBenefits: Record<string, string> }
      ).quickBenefits;
      expect(Object.keys(group).sort()).toEqual([...KEYS].sort());
    }
  });
});
