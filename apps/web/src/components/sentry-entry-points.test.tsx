import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isSentryConfigured } from "@/lib/sentry-configured";
import { codeOnly } from "@/test/source";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));
vi.mock("@/lib/server", () => ({ signOut: vi.fn() }));
vi.mock("@/components/locale-switcher", () => ({ LocaleSwitcher: () => null }));
vi.mock("@/components/theme-switcher", () => ({ ThemeSwitcher: () => null }));
vi.mock("@/components/report-problem", () => ({
  useReportProblem: () => ({ label: "Report a problem", open: vi.fn() }),
}));

import { MobileDrawer } from "./nav/mobile-drawer";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));

const DSN = "https://k@o1.ingest.de.sentry.io/2";

/** Each entry point, wrapped in the `isSentryConfigured()` check. */
const GUARDED_CONSENT_BAR = /isSentryConfigured\(\) && <ReplayConsent \/>/;
const GUARDED_FOOTER_SETTINGS =
  /isSentryConfigured\(\) && \(\s*<li>\s*<FooterPrivacySettings/;
const GUARDED_FOOTER_REPORT =
  /isSentryConfigured\(\) && \(\s*<li>\s*<FooterReportProblem/;
const GUARDED_MENU_REPORT =
  /isSentryConfigured\(\) && \(\s*<DropdownMenuItem[^>]*onSelect=\{report\.open\}/;

afterEach(() => {
  vi.unstubAllEnvs();
});

const drawer = () =>
  renderToString(
    <MobileDrawer
      account={null}
      isMember={false}
      onNavigate={() => undefined}
      projectLinks={[]}
    />
  );

describe("isSentryConfigured", () => {
  it.each([
    [undefined, false],
    ["", false],
    ["  ", false],
    [DSN, true],
  ])("is %s → %s", (dsn, expected) => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
    expect(isSentryConfigured()).toBe(expected);
  });
});

describe("Sentry entry points without a DSN", () => {
  it("the mobile drawer has no Report a problem", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(drawer()).not.toContain("Report a problem");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    expect(drawer()).toContain("Report a problem");
  });

  it.each([
    ["the consent bar", "../app/layout.tsx", GUARDED_CONSENT_BAR],
    [
      "the footer's Privacy settings",
      "layout/footer-v2.tsx",
      GUARDED_FOOTER_SETTINGS,
    ],
    [
      "the footer's Report a problem",
      "layout/footer-v2.tsx",
      GUARDED_FOOTER_REPORT,
    ],
    [
      "the account menu's Report a problem",
      "nav/account-menu.tsx",
      GUARDED_MENU_REPORT,
    ],
  ])("%s is rendered only when Sentry is configured", (_label, file, guard) => {
    expect(read(file)).toMatch(guard);
  });
});
