import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  APP_BANNER_DISMISSED_KEY,
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
} from "@/lib/app-links";
import { codeOnly } from "@/test/source";

const MESSAGES: Record<string, string> = {
  title: "Did you know we have an app too?",
  subtitle: "Events, member pass and benefits in your pocket.",
  appleHint: "Download on the",
  appleStore: "App Store",
  googleHint: "Get it on",
  googlePlay: "Google Play",
  dismiss: "Dismiss app banner",
};

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => MESSAGES[key] ?? key,
}));

import {
  MobileAppBannerView,
  persistAppBannerDismissal,
  wasAppBannerDismissed,
} from "./mobile-app-banner";

const shell = codeOnly(
  readFileSync(join(import.meta.dirname, "site-shell.tsx"), "utf8")
);

describe("MobileAppBanner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the Apple App Store button on iOS devices", () => {
    const html = renderToStaticMarkup(
      <MobileAppBannerView onDismiss={vi.fn()} platform="ios" />
    );

    expect(html).toContain("Did you know we have an app too?");
    expect(html).toContain(`href="${APP_STORE_URL}"`);
    expect(html).toContain('data-store-platform="ios"');
    expect(html).toContain("Download on the");
    expect(html).toContain("App Store");
    expect(html).not.toContain(GOOGLE_PLAY_URL);
    expect(html).toContain('aria-label="Dismiss app banner"');
  });

  it("renders the Google Play button on Android devices", () => {
    const html = renderToStaticMarkup(
      <MobileAppBannerView onDismiss={vi.fn()} platform="android" />
    );

    expect(html).toContain("Did you know we have an app too?");
    expect(html).toContain(`href="${GOOGLE_PLAY_URL}"`);
    expect(html).toContain('data-store-platform="android"');
    expect(html).toContain("Get it on");
    expect(html).toContain("Google Play");
    expect(html).not.toContain(APP_STORE_URL);
    expect(html).toContain('aria-label="Dismiss app banner"');
  });

  it("persists dismissal in localStorage so the banner does not open again", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });

    expect(wasAppBannerDismissed()).toBe(false);
    persistAppBannerDismissal();
    expect(store.get(APP_BANNER_DISMISSED_KEY)).toBe("1");
    expect(wasAppBannerDismissed()).toBe(true);
  });

  it("degrades safely when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    });

    expect(wasAppBannerDismissed()).toBe(false);
    expect(() => persistAppBannerDismissal()).not.toThrow();
  });

  it("is mounted in SiteShell", () => {
    expect(shell).toContain("<MobileAppBanner />");
  });
});
