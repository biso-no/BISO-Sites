import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const footer = read("footer-v2.tsx");
const social = read("footer-social.tsx");
const shell = read("site-shell.tsx");

describe("footer (RD-014)", () => {
  it("is a Server Component", () => {
    // The old footer was "use client" only because it called useTranslations
    // and ran five whileInView reveals, so it shipped its whole markup to the
    // browser for no interactive behaviour.
    expect(footer).not.toContain('"use client"');
    expect(footer).toContain("getTranslations");
  });

  it("keeps the client island to the tracked social links only", () => {
    expect(social).toContain('"use client"');
    expect(social).toContain("trackEvent");
    // Nothing else should have leaked into the island.
    expect(social).not.toContain("getTranslations");
  });

  it("routes internal links client-side", () => {
    // Every footer link was a bare <a>, so each click was a full page reload.
    expect(footer).toContain("<Link");
    expect(footer).toContain('href.startsWith("http")');
  });

  it("has no scroll-triggered reveals", () => {
    expect(footer).not.toContain("whileInView");
    expect(footer).not.toContain("motion");
  });

  it("drops the off-brand social hover and makes the buttons visible", () => {
    // They were bg-inverted on a bg-inverted footer — invisible until hover —
    // and hovered to a purple/pink gradient unrelated to the palette.
    expect(social).not.toContain("purple-600");
    expect(social).not.toContain("pink-600");
    expect(social).toContain("border-edge");
    expect(social).toContain("aria-label");
  });

  it("renders only counts that come from real data", () => {
    // PLACEHOLDER-004: the reference shows "1000+ Active Members". Member
    // counts are not public data, so that tile is omitted rather than invented.
    // Each tile is pushed only when its source returned something.
    expect(footer).toContain("if (societies > 0)");
    expect(footer).toContain("counts.eventCount > 0");
    expect(footer).toContain("counts.jobCount > 0");
    expect(footer).toContain("campuses.length > 0");
    // and a failing read degrades to fewer tiles, never to a guess
    expect(footer).toContain(".catch(() => null)");
  });

  it("is the only footer the shell renders (RD-030)", () => {
    // The `BISO_SHELL_V2` toggle and the v1 footer are gone; there is one
    // footer and no branch selecting it.
    expect(shell).toContain("<FooterV2 />");
    expect(shell).not.toContain("shellV2");
    expect(shell).not.toContain("isShellV2Enabled");
  });
});
