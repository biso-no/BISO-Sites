import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isSentryConfigured } from "./sentry-configured";

const DSN = "https://k@o1.ingest.de.sentry.io/2";
const original = process.env.NEXT_PUBLIC_SENTRY_DSN;

const read = (path: string) =>
  readFileSync(join(import.meta.dir, path), "utf8");

/** Each entry point, wrapped in the `isSentryConfigured()` check. */
const GUARDED_CONSENT_BAR = /isSentryConfigured\(\) && <ReplayConsent/;
const GUARDED_SIDEBAR_BUTTONS =
  /isSentryConfigured\(\) && \(\s*<>\s*<button[\s\S]*?onClick=\{openReplayConsentSettings\}[\s\S]*?onClick=\{report\.open\}[\s\S]*?<\/>\s*\)/;
const PALETTE_FILTER = /cmd\.needsSentry && !isSentryConfigured\(\)/;
const PALETTE_COMMANDS =
  /id: "privacy-settings",[^}]*needsSentry: true[\s\S]*?id: "report-problem",[^}]*needsSentry: true/;

afterEach(() => {
  if (original === undefined) {
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_SENTRY_DSN");
  } else {
    process.env.NEXT_PUBLIC_SENTRY_DSN = original;
  }
});

describe("isSentryConfigured", () => {
  test.each([
    [undefined, false],
    ["", false],
    ["  ", false],
    [DSN, true],
  ])("is %p → %p", (dsn, expected) => {
    if (dsn === undefined) {
      Reflect.deleteProperty(process.env, "NEXT_PUBLIC_SENTRY_DSN");
    } else {
      process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;
    }
    expect(isSentryConfigured()).toBe(expected);
  });
});

describe("Sentry entry points without a DSN", () => {
  test.each([
    "(portal)",
    "(editor)",
    "(auth)",
    "(protected)",
  ])("the %s layout mounts the consent bar only when Sentry is configured", (group) => {
    expect(read(`../app/${group}/layout.tsx`)).toMatch(GUARDED_CONSENT_BAR);
  });

  test("the sidebar's Privacy settings and Report a problem need it too", () => {
    expect(read("../app/(portal)/sidebar.tsx")).toMatch(
      GUARDED_SIDEBAR_BUTTONS
    );
  });

  test("the command palette drops both commands without it", () => {
    const palette = read("../app/(portal)/_components/command-palette.tsx");
    expect(palette).toMatch(PALETTE_COMMANDS);
    expect(palette).toMatch(PALETTE_FILTER);
  });
});
