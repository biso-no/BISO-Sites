import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { APP_LINK_COMPONENTS } from "./app-links";

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
});
