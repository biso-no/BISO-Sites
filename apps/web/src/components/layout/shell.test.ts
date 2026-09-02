import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const shell = read("site-shell.tsx");
const skip = read("skip-link.tsx");
const rootLayout = codeOnly(
  readFileSync(join(import.meta.dirname, "../../app/layout.tsx"), "utf8")
);
const authLayout = codeOnly(
  readFileSync(join(import.meta.dirname, "../../app/(auth)/layout.tsx"), "utf8")
);
const notFound = codeOnly(
  readFileSync(join(import.meta.dirname, "../../app/not-found.tsx"), "utf8")
);
const unauthorized = codeOnly(
  readFileSync(join(import.meta.dirname, "../../app/unauthorized.tsx"), "utf8")
);

describe("shell structure (RD-013)", () => {
  it("keeps <main> out of the root layout", () => {
    // A <main> here wraps every route group, swallowing SiteShell's own <main>,
    // <nav> and <footer>. Every page rendered two nested <main> elements with
    // the banner and contentinfo landmarks buried inside the first.
    expect(rootLayout).not.toContain("<main");
  });

  it("gives each route group exactly one <main>", () => {
    expect(shell).toContain("<main");
    expect(authLayout).toContain("<main"); // (auth) renders outside SiteShell
    expect(unauthorized).toContain("<main"); // the auth gate throws before the shell
    // not-found renders INSIDE SiteShell — the (public) catch-all commits the
    // layout before calling notFound() — so it must not open its own.
    expect(notFound).not.toContain("<main");
  });

  it("orders the landmarks banner -> main -> contentinfo", () => {
    const nav = shell.indexOf("<Navigation");
    const main = shell.indexOf("<main");
    const footer = shell.indexOf("<Footer");
    expect(nav).toBeGreaterThan(-1);
    expect(nav).toBeLessThan(main);
    expect(main).toBeLessThan(footer);
  });

  it("puts the skip link before the navigation", () => {
    expect(shell.indexOf("<SkipLink")).toBeLessThan(
      shell.indexOf("<Navigation")
    );
  });

  it("keeps every skip-link visual style behind focus:", () => {
    // Padding or a background alongside `sr-only` inflates its 1x1 box: px-4
    // py-2 alone made this a 32x16 coloured rectangle at the top of every page.
    expect(skip).toContain("sr-only");
    for (const cls of ["bg-action", "px-4", "py-2", "rounded-biso-md"]) {
      expect(skip).toContain(`focus:${cls}`);
      expect(skip).not.toMatch(new RegExp(`(^|["\\s])${cls}(\\s|"|$)`));
    }
  });

  it("makes <main> a focus target for the skip link", () => {
    expect(shell).toContain("tabIndex={-1}");
    expect(shell).toContain("id={MAIN_CONTENT_ID}");
  });
});
