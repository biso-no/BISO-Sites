import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeOnly } from "@/test/source";
import {
  ABOUT_COLUMNS,
  hasSolidNavRoute,
  NAV_OVERFLOW_DROP_ORDER,
  STANDALONE_LINKS,
} from "./nav-config";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));
const hook = read("use-mega-panels.ts");
const v2 = read("mega-nav-v2.tsx");
const desktopMenu = read("desktop-menu.tsx");
const drawer = read("mobile-drawer.tsx");
const campusLink = read("campus-link.tsx");
const pill = read("../ui/campus-pill.tsx");
const studentsPanel = read("panels/students-panel.tsx");
const projectsPanel = read("panels/projects-panel.tsx");
const shell = read("../layout/site-shell.tsx");

/** A `/campus/<slug>` template literal in the source. */
const CAMPUS_LANDING_TEMPLATE = /`\/campus\/\$\{/;

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

  it("lets the menu row give way instead of overlapping the utilities", () => {
    // The menu box was `flex-1 min-w-0` with nothing watching it: it shrank
    // while its contents did not, so the menu painted over the campus pill and
    // no width probe could see it. The redesign made both groups `shrink-0`.
    // Merging main gave Business its own row entry in a bar that had 4px to
    // spare, so the menu box is a measured budget again — but now
    // `useNavOverflow` collapses the standalone links into a "…" menu until
    // the row fits, and the utility group still never shrinks.
    expect(v2).not.toContain("flex-1 justify-start");
    expect(v2).toContain("useNavOverflow({");
    expect(v2).toContain("dropOrder: NAV_OVERFLOW_DROP_ORDER");
    expect(v2).toContain("<NavOverflowMenu");
    expect(v2).toContain(
      "hidden shrink-0 items-center gap-2 min-[1340px]:flex"
    );
    // Only the standalone links may collapse — never the panel triggers — and
    // every one of them must be in the drop order, or it could overflow.
    expect([...NAV_OVERFLOW_DROP_ORDER].sort()).toEqual(
      STANDALONE_LINKS.map((link) => link.id).sort()
    );
  });

  it("uses links, not router.push, for navigation", () => {
    // Three buttons called router.push, losing prefetch, middle-click and
    // open-in-new-tab. The drawer's four buttons did the same until the merge
    // restyled it.
    for (const source of [v2, drawer]) {
      expect(source).not.toContain("router.push");
      expect(source).not.toContain("useRouter");
    }
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

describe("the campus control", () => {
  it("filters, and does not navigate", () => {
    // The header control has one job. Picking a campus re-scopes the page you
    // are on; it never takes you to a campus page. The way to a campus's own
    // page is the Campus column of the "For students" panel.
    expect(pill).toContain("campusSwitchHref(pathname");
    expect(pill).not.toContain("campusLandingHref");
  });

  it("does not send you to /campus just for choosing a campus", () => {
    // The regression this replaces: every option was a link to
    // `/campus/<slug>`, so asking for Bergen's events left the events page.
    expect(pill).not.toMatch(CAMPUS_LANDING_TEMPLATE);
  });

  it("falls back to persisting the choice where the URL cannot carry it", () => {
    // On a page with no campus dimension there is nothing to link to, so the
    // option is a button that writes the cookie and refreshes.
    expect(pill).toContain("refresh: hrefFor");
  });

  it("renders exactly one campus switcher in the mobile drawer", () => {
    // `<CampusPill>` is pinned at the top of the drawer by the header. A
    // second, cookie-only `<SelectCampus>` sat three screens below it and
    // silently lost to `?campus=` on every scoped page.
    expect(drawer).not.toContain("SelectCampus");
    expect(existsSync(join(import.meta.dirname, "../select-campus.tsx"))).toBe(
      false
    );
  });

  it("lists no campuses in the menus", () => {
    // RD-035 had the Campus column list all five, each a link to its page.
    // The Branding Committee (main #95) then took the list out of the "For
    // students" panel and the drawer: the header control is the one place to
    // change campus. Every entry used to `router.push("/campus")` as well.
    for (const source of [studentsPanel, drawer, campusLink]) {
      expect(source).not.toContain("campuses.map");
    }
    expect(campusLink).not.toContain("selectCampus");
    expect(campusLink).not.toContain("router.push");
  });

  it("keeps one link to the active campus's own page", () => {
    // With the header control filtering only, this is the single designated
    // way to a campus's own page — so it must name the campus you are on, and
    // fall back to the overview rather than guessing one.
    expect(studentsPanel).toContain("<ActiveCampusLink");
    expect(drawer).toContain("<ActiveCampusLink");
    expect(campusLink).toContain("campusLandingHref(resolved)");
    expect(campusLink).toContain('t("campusOverview")');
  });

  it("resolves that campus from the URL, not the cookie alone", () => {
    // Reading only the stored preference meant following a shared
    // `/events?campus=bergen` gave a header saying Bergen above a menu
    // offering the campus overview. Both read `useScopedCampusId` now.
    expect(campusLink).toContain("useScopedCampusId()");
    expect(pill).toContain("useScopedCampusId()");
  });
});

describe("main's header behaviour, carried into the redesign", () => {
  it("decides the membership CTA from the server's answer", () => {
    // `SiteShell` passes `isMember` so an existing member is not offered
    // membership on the first paint; members get no primary CTA on desktop
    // and their portal as the drawer's primary action.
    expect(shell).toContain("isMember={membershipStatus?.isMember ?? false}");
    expect(v2).toContain("const memberActive = isMember ?? memberFromContext");
    expect(v2).toContain("{memberActive ? null : (");
    expect(v2).toContain(
      'trackEvent("membership_cta_click", { source: "nav" })'
    );
    expect(v2).toContain("isMember={memberActive}");
    expect(drawer).toContain('href="/member"');
  });

  it("lists the visitor's campus projects under the flagship hubs", () => {
    // main #93: the Projects menu follows campus. The units come from the
    // server once; the client picks the visible campus's entries — the
    // campus the page shows, as the pill resolves it.
    expect(shell).toContain("projectLinks={campusProjectNavLinks(units)}");
    expect(v2).toContain("projectLinks={projectLinks}");
    expect(projectsPanel).toContain(
      "visibleProjectLinks(projectLinks, campusId)"
    );
    expect(projectsPanel).toContain("useScopedCampusId()");
    expect(drawer).toContain("<CampusProjectLinks");
  });

  it("gives Business a header entry of its own", () => {
    // The merged About page dropped the business links from its menu; they
    // keep a header entry, which on desktop may collapse into "…".
    const ids = STANDALONE_LINKS.map((link) => link.id);
    expect(ids).toContain("business");
    const aboutHrefs = ABOUT_COLUMNS.flatMap((column) =>
      column.links.map((link) => link.href)
    );
    expect(aboutHrefs).not.toContain("/business");
    expect(aboutHrefs).not.toContain("/business-hotspot");
  });

  it("keeps the header solid on pages that do not open on navy", () => {
    expect(v2).toContain("hasSolidNavRoute(pathname)");
    expect(hasSolidNavRoute("/fs/new")).toBe(true);
    // The approver's page opens on a `PageHeader` since the merge.
    expect(hasSolidNavRoute("/fs/approve/abc")).toBe(false);
    expect(hasSolidNavRoute("/fs")).toBe(false);
    expect(hasSolidNavRoute("/")).toBe(false);
  });
});
