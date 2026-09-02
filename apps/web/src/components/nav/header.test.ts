import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const hook = read("use-mega-panels.ts");
const v2 = read("mega-nav-v2.tsx");
const desktopMenu = read("desktop-menu.tsx");
const shell = read("../layout/site-shell.tsx");

describe("header (RD-017)", () => {
  it("keeps the panel behaviour in a hook, not in the header", () => {
    // RD-017 proved "preserved verbatim" as a fact about the module graph:
    // both headers imported the same hook. RD-030 deleted the v1 header, so
    // what survives is the hook and the one header that uses it.
    expect(v2).toContain("useMegaPanels()");
    expect(existsSync(join(import.meta.dirname, "mega-nav.tsx"))).toBe(false);
  });

  it("keeps all four panel behaviours in the hook", () => {
    expect(hook).toContain("CLOSE_DELAY_MS = 120"); // hover intent
    expect(hook).toContain('event.key === "ArrowDown"');
    expect(hook).toContain('event.key === "Escape"');
    expect(hook).toContain(
      'addEventListener("pointerdown", handlePointerDown)'
    );
  });

  it("stops Escape from reopening what it just closed", () => {
    // The programmatic refocus fired the trigger's focus handler, which
    // reopened the panel — so Escape never worked. Verified in the browser:
    // focusing a trigger with no key events at all opens its panel.
    expect(hook).toContain("suppressFocusOpenRef");
    const escapeBlock = hook.slice(
      hook.indexOf('event.key === "Escape" && current')
    );
    expect(escapeBlock.slice(0, 200)).toContain(
      "suppressFocusOpenRef.current = true"
    );
  });

  it("closes when focus leaves the header, not only the pointer", () => {
    // Without this a keyboard user who tabs past the header leaves the panel
    // hanging open until they press Escape.
    expect(hook).toContain('addEventListener("focusout"');
    expect(hook).toContain("mouseleave");
  });

  it("shows the desktop bar only at a width it fits in", () => {
    // RD-017 moved the breakpoint down to `lg` so laptops under 1280px would
    // get the full bar rather than a hamburger. Measured during RD-020, the
    // bar needs ~1300px: logo 140–190 + menu 516 (its intrinsic width; the
    // items do not shrink) + utilities 547 (`shrink-0`) + 32 of gaps, inside
    // a bar that is the viewport less 64 of padding. Between 1024 and ~1340
    // the menu was overlapping the campus pill, locale switcher and Shop link
    // in both locales. Until the bar's content budget comes down, it renders
    // only where it fits.
    expect(v2).toContain("min-[1340px]:flex");
    expect(v2).toContain("min-[1340px]:hidden");
    expect(v2).not.toContain("lg:flex");
    expect(v2).not.toContain("lg:hidden");
    expect(v2).not.toContain("xl:flex");
  });

  it("keeps both bar groups unshrinkable so an overflow is visible", () => {
    // The menu box was `flex-1 min-w-0`: it shrank while its contents did not,
    // so the overlap never widened the page and no width probe could see it.
    expect(v2).not.toContain("flex-1 justify-start");
  });

  it("uses links, not router.push, for navigation", () => {
    // Three buttons called router.push, losing prefetch, middle-click and
    // open-in-new-tab.
    expect(v2).not.toContain("router.push");
    expect(v2).not.toContain("useRouter");
  });

  it("drops the backdrop blur", () => {
    expect(v2).not.toContain("backdrop-blur");
  });

  it("gives the nav triggers a visible focus ring", () => {
    // They had no focus styling at all — Phase 0 found focus-visible in 2 of
    // 139 component files.
    expect(desktopMenu).toContain("focus-visible:ring-2");
  });

  it("is the only header the shell renders (RD-030)", () => {
    expect(shell).toContain("<NavigationV2");
    expect(shell).not.toContain("<Navigation ");
    expect(shell).not.toContain("isShellV2Enabled");
  });
});
