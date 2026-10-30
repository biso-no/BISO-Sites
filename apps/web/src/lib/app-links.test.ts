import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  APP_LINK_COMPONENTS,
  APP_STORE_URL,
  APP_STORE_URLS,
  detectMobilePlatform,
  GOOGLE_PLAY_URL,
} from "./app-links";

// Only `/auth/verify` and `/app/*` use trailing-wildcard syntax here, so a
// small matcher is enough to check which paths a component would claim.
function claims(pattern: string, pathname: string): boolean {
  if (pattern.endsWith("/*")) {
    return pathname.startsWith(pattern.slice(0, -1));
  }
  return pattern === pathname;
}

const claimedBy = (pathname: string) =>
  APP_LINK_COMPONENTS.filter((component) => claims(component["/"], pathname));

describe("app links", () => {
  it("claims the app sign-in link and /app/*", () => {
    expect(claimedBy("/auth/verify")).toHaveLength(1);
    expect(claimedBy("/app/jobs")).toHaveLength(1);
  });

  it("does not claim the website's own auth returns", () => {
    for (const pathname of [
      "/auth/callback",
      "/auth/oauth",
      "/auth/login",
      "/auth/invite",
      "/auth/anything",
    ]) {
      expect(claimedBy(pathname)).toEqual([]);
    }
    expect(APP_LINK_COMPONENTS.map((c) => c["/"])).not.toContain("/auth/*");
  });

  it("the static association file matches APP_LINK_COMPONENTS", () => {
    const file = path.join(
      process.cwd(),
      "public/.well-known/apple-app-site-association"
    );
    const json = JSON.parse(readFileSync(file, "utf8"));
    expect(json.applinks.apps).toEqual([]);
    expect(json.applinks.details).toEqual([
      {
        appIDs: ["4JQ6VWVRGY.com.biso.no"],
        components: APP_LINK_COMPONENTS,
      },
    ]);
  });

  it("points store links at the BISO listings on Apple App Store and Google Play", () => {
    expect(APP_STORE_URL).toBe("https://apps.apple.com/app/id6468173379");
    expect(GOOGLE_PLAY_URL).toBe(
      "https://play.google.com/store/apps/details?id=com.biso.no"
    );
    expect(APP_STORE_URLS).toEqual({
      ios: APP_STORE_URL,
      android: GOOGLE_PLAY_URL,
    });
  });

  it("detects iOS and Android devices and returns null on desktop", () => {
    expect(
      detectMobilePlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe("ios");
    expect(
      detectMobilePlatform(
        "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15"
      )
    ).toBe("ios");
    // iPadOS 13+ sends a desktop Macintosh UA with multi-touch support.
    expect(
      detectMobilePlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        5
      )
    ).toBe("ios");
    expect(
      detectMobilePlatform(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36"
      )
    ).toBe("android");

    // Desktop browsers must not show the mobile app banner.
    expect(
      detectMobilePlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        0
      )
    ).toBeNull();
    expect(
      detectMobilePlatform(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0"
      )
    ).toBeNull();
    expect(
      detectMobilePlatform(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0"
      )
    ).toBeNull();
    expect(detectMobilePlatform("")).toBeNull();
  });
});
