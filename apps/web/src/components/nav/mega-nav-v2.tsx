"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { ImageWithFallback } from "@repo/ui/components/image";
import { cn } from "@repo/ui/lib/utils";
import { Menu, ShoppingCart, X } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCampus } from "@/components/context/campus";
import { useUserMembership } from "@/components/context/membership-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import {
  SEARCH_PANEL_ID,
  SEARCH_SHEET_ID,
  SearchTrigger,
} from "@/components/search/search-trigger";
import { useSearchShortcut } from "@/components/search/use-search-shortcut";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { CampusPill } from "@/components/ui/campus-pill";
import { useCart } from "@/lib/contexts/cart-context";
import type { NavAccount, NavFeatured, NavProjectLink } from "@/lib/types/nav";
import { AccountMenu } from "./account-menu";
import { DesktopMenu, NavRowLink, NavRowLinkGhost } from "./desktop-menu";
import { MegaPanel } from "./mega-panel";
import { MobileDrawer } from "./mobile-drawer";
import {
  HEADER_CONTAINER_CLASS,
  HEADER_LOGO_WIDTH_CLASS,
  hasSolidNavRoute,
  NAV_OVERFLOW_DROP_ORDER,
  OVERFLOW_TRIGGER_KEY,
  STANDALONE_LINKS,
} from "./nav-config";
import {
  NavOverflowMenu,
  NavOverflowTriggerGhost,
  type OverflowEntry,
} from "./overflow-menu";
import { AboutPanel } from "./panels/about-panel";
import { ProjectsPanel } from "./panels/projects-panel";
import { StudentsPanel } from "./panels/students-panel";
import { useMegaPanels } from "./use-mega-panels";
import { useNavOverflow } from "./use-nav-overflow";

/**
 * The redesigned header.
 *
 * **Panel behaviour is unchanged.** Hover intent, `ArrowDown`, `Escape` and
 * outside-click all come from `useMegaPanels`, the hook extracted from the old
 * header — not a copy. RD-017 restyled the header; it did not rewrite the best
 * keyboard handling in the codebase.
 *
 * What changed from the old header (`00-current-state.md` §8.3,
 * `01-design-spec.md` §3.5):
 *   - **Nine utility controls became six**: campus, locale, theme, cart, one
 *     primary CTA, account. The member portal lives in the account menu; the
 *     "apply" button went, because jobs are in the "For students" panel; the
 *     business link is a row link beside News and Shop. The theme toggle stays
 *     here as `<ThemeSwitcher>`: for an anonymous visitor the account menu is a
 *     plain sign-in link, so a control placed there would not exist for most
 *     traffic.
 *   - **The CTA is decided by the server.** `isMember` comes from `SiteShell`,
 *     so an existing member is never shown "Become a member" on the first
 *     paint; members get no primary CTA at all (their portal is in the account
 *     menu, and in the drawer's primary action).
 *   - **Real `<Link>`s, not `router.push()` buttons**, restoring prefetch,
 *     middle-click and open-in-new-tab.
 *   - **Solid on scroll, no blur** — the design system has no translucent
 *     surfaces. Routes in `SOLID_NAV_ROUTES` are solid from the first paint.
 *   - **Campus is a labelled pill** that filters the page you are on; it never
 *     navigates. The way to a campus's own page is the "For students" panel.
 *   - **The Projects panel follows campus**: the flagship hubs, then the
 *     project units of the campus the page shows (`projectLinks`).
 *
 * **Search** is not a mega panel and does not go through `useMegaPanels`: it
 * must not close when the mouse leaves the header. Its trigger opens a bar
 * over the header row with results in a panel below (desktop) or a
 * full-screen sheet (phones); `/` and Ctrl/Cmd+K open whichever the viewport
 * shows. The quick search is loaded on open, never with the header. Opening
 * search closes any panel and the drawer; a panel opening closes search.
 *
 * PLACEHOLDER-001: the logo lockup wants the BISO chevron as a vector. Only a
 * PNG exists, so the existing asset is used until an SVG is supplied.
 */
interface NavigationV2Props {
  /** Resolved server-side; `null` for anonymous visitors. */
  account?: NavAccount | null;
  featured?: NavFeatured;
  /** Membership resolved server-side, so the CTA is right on the first paint. */
  isMember?: boolean;
  /** Unit-run projects with a public page, resolved server-side. */
  projectLinks?: NavProjectLink[];
}

const EMPTY_FEATURED: NavFeatured = { event: null, project: null, news: null };
const EMPTY_PROJECT_LINKS: NavProjectLink[] = [];

/**
 * Shared by the measured row and its ghost. They must resolve to the same
 * typography, or the ghost measures a different string than the row draws.
 */
const ROW_CLASS = "flex items-center gap-0.5 text-[0.92rem]";

/** Where the desktop bar takes over from the drawer; matches `min-[1340px]:`. */
const DESKTOP_MEDIA_QUERY = "(min-width: 1340px)";

type SearchLayout = "panel" | "sheet";

/** Loaded when search first opens, so the header's first paint never carries it. */
const QuickSearch = dynamic(() => import("@/components/search/quick-search"), {
  ssr: false,
});

export function NavigationV2({
  account = null,
  featured = EMPTY_FEATURED,
  isMember,
  projectLinks = EMPTY_PROJECT_LINKS,
}: NavigationV2Props) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const {
    navRef,
    openPanel,
    isScrolled,
    clearCloseTimer,
    closeNow,
    scheduleClose,
    togglePanel,
    handleTriggerPointerDown,
    handleTriggerFocus,
    handleTriggerKeyDown,
    openPanelNow,
    registerTrigger,
  } = useMegaPanels();

  const { getItemCount, openDrawer } = useCart();
  const { isMember: memberFromContext } = useUserMembership();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("common.navigation");
  const tShop = useTranslations("shop");
  const cartCount = getItemCount();
  const memberActive = isMember ?? memberFromContext;
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);
  const { activeCampusId } = useCampus();

  // Search: open as the desktop panel or the phone sheet, or closed.
  const [searchLayout, setSearchLayout] = useState<SearchLayout | null>(null);
  const searchOpen = searchLayout !== null;
  const panelTriggerRef = useRef<HTMLButtonElement>(null);
  const sheetTriggerRef = useRef<HTMLButtonElement>(null);
  const lastSearchLayoutRef = useRef<SearchLayout | null>(null);
  const returnFocusRef = useRef(false);

  const openSearch = useCallback(
    (layout: SearchLayout) => {
      closeNow();
      setIsMobileOpen(false);
      setSearchLayout(layout);
    },
    [closeNow]
  );
  const openSearchForViewport = useCallback(() => {
    openSearch(
      window.matchMedia(DESKTOP_MEDIA_QUERY).matches ? "panel" : "sheet"
    );
  }, [openSearch]);
  useSearchShortcut(openSearchForViewport);

  const closeSearch = useCallback((returnFocus: boolean) => {
    returnFocusRef.current = returnFocus;
    setSearchLayout(null);
  }, []);
  const closeSearchFromInside = useCallback(
    () => closeSearch(true),
    [closeSearch]
  );

  // A mega panel opening closes search (opening search closed the panels
  // above). Leaving the page closes it too, however the visitor left.
  const [searchPathname, setSearchPathname] = useState(pathname);
  if (pathname !== searchPathname) {
    setSearchPathname(pathname);
    setSearchLayout(null);
  } else if (openPanel !== null && searchLayout !== null) {
    setSearchLayout(null);
  }

  // Focus goes back to the trigger for the layout that was open. Run after
  // the commit: the desktop trigger is inert while the bar covers it.
  useEffect(() => {
    if (searchLayout) {
      lastSearchLayoutRef.current = searchLayout;
      return;
    }
    if (!returnFocusRef.current) {
      return;
    }
    returnFocusRef.current = false;
    const trigger =
      lastSearchLayoutRef.current === "panel"
        ? panelTriggerRef.current
        : sheetTriggerRef.current;
    trigger?.focus();
  }, [searchLayout]);

  // While open: a pointer press or focus outside the header closes the
  // desktop panel (mouse-leave does not), and crossing the breakpoint closes
  // either layout, since it no longer matches the screen.
  useEffect(() => {
    if (!searchLayout) {
      return;
    }
    const isOutside = (target: EventTarget | null) =>
      !(target instanceof Node && navRef.current?.contains(target));
    const handleOutside = (event: Event) => {
      if (searchLayout === "panel" && isOutside(event.target)) {
        closeSearch(false);
      }
    };
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const handleBreakpoint = () => closeSearch(false);
    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("focusin", handleOutside);
    media.addEventListener("change", handleBreakpoint);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("focusin", handleOutside);
      media.removeEventListener("change", handleBreakpoint);
    };
  }, [searchLayout, navRef, closeSearch]);

  // The bar covers the menu row and the utilities: keep focus out of them.
  const coveredBySearch = searchLayout === "panel";

  // What fits in the row is measured, not guessed from breakpoints: the
  // utility group's width moves with the locale, the campus name, whether the
  // visitor is signed in and whether they are a member. `signature` re-runs
  // the measurement when one of those changes a label the observers would not
  // see as a resize.
  const { ghostRef, hiddenKeys, rowRef } = useNavOverflow({
    dropOrder: NAV_OVERFLOW_DROP_ORDER,
    signature: `${locale}|${account ? "auth" : "anon"}|${memberActive ? "member" : "guest"}`,
  });
  const hidden = new Set(hiddenKeys);
  const overflowEntries: OverflowEntry[] = STANDALONE_LINKS.filter((link) =>
    hidden.has(link.id)
  ).map((link) => ({
    href: link.href,
    icon: link.icon,
    key: link.id,
    label: t(link.labelKey),
  }));

  // Solid whenever something hangs below the bar — a panel, search or the
  // drawer — and from the first paint on the routes that do not open on navy.
  const solid =
    isScrolled ||
    openPanel !== null ||
    searchOpen ||
    isMobileOpen ||
    hasSolidNavRoute(pathname);

  return (
    <nav
      className={cn(
        "fixed top-0 right-0 left-0 z-50 transition-colors duration-200",
        // Solid navy rather than a translucent blur. `data-surface="deep"`
        // flips --ink/--action/--edge so nothing inside branches on surface.
        solid ? "bg-surface shadow-elev-1" : "bg-transparent"
      )}
      data-surface="deep"
      ref={navRef}
    >
      <div className={HEADER_CONTAINER_CLASS}>
        <div className="flex h-20 items-center justify-between gap-4">
          <Link
            className={cn(
              "relative block h-11 shrink-0 rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              HEADER_LOGO_WIDTH_CLASS
            )}
            href="/"
          >
            <ImageWithFallback
              alt="BISO"
              className="object-contain object-left"
              fill
              priority
              sizes="(max-width: 640px) 42vw, 190px"
              src="/images/home-logo.png"
            />
          </Link>

          {/* The desktop bar appears only from 1340px, and within it the menu
              row is measured. Measured at that breakpoint during RD-035, logo
              + menu + utilities left a 4px gutter — the row was full before
              Business got an entry of its own. So the standalone links
              (Business, then Shop, then News) give way to a "…" menu when the
              row runs out of room, instead of painting over the utility group.

              This box is the row's budget: `min-w-0` lets it be narrower than
              its contents, which is what lets `useNavOverflow` see a
              shortfall. The panel triggers never collapse; at 1340px they fit
              beside the utility group with all three links folded away (the
              RD-035 measurement had News and Shop inside the 516px menu), and
              below 1340px the drawer takes over. The utility group stays
              `shrink-0`, so it is never squeezed. */}
          <div
            className="relative hidden min-w-0 flex-1 min-[1340px]:block"
            inert={coveredBySearch}
          >
            <div className={cn(ROW_CLASS, "min-w-0")} ref={rowRef}>
              <div
                className="flex shrink-0 items-center"
                data-nav-key="triggers"
              >
                <DesktopMenu
                  onPanelEnter={openPanelNow}
                  onPanelFocus={handleTriggerFocus}
                  onPanelKeyDown={handleTriggerKeyDown}
                  onPanelPointerDown={handleTriggerPointerDown}
                  onPanelToggle={togglePanel}
                  openPanel={openPanel}
                  registerTrigger={registerTrigger}
                />
              </div>
              {STANDALONE_LINKS.map((link) =>
                hidden.has(link.id) ? null : (
                  <div
                    className="flex shrink-0 items-center"
                    data-nav-key={link.id}
                    key={link.id}
                  >
                    <NavRowLink
                      href={link.href}
                      icon={link.icon}
                      label={t(link.labelKey)}
                      onActivate={closeNow}
                    />
                  </div>
                )
              )}
              {overflowEntries.length > 0 && (
                <div
                  className="flex shrink-0 items-center"
                  data-nav-key={OVERFLOW_TRIGGER_KEY}
                >
                  <NavOverflowMenu
                    entries={overflowEntries}
                    label={t("moreMenu")}
                  />
                </div>
              )}
            </div>

            {/* Measurement ghost: an item sitting in the "…" menu is not in the
                row to be measured, and the "…" trigger does not exist until
                something is hidden. This invisible, inert copy keeps every
                width the decision depends on available — and, being real DOM
                rather than a cached number, it stays right when the font loads
                or the locale changes the labels. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
              inert
            >
              <div className={cn(ROW_CLASS, "invisible")} ref={ghostRef}>
                {STANDALONE_LINKS.map((link) => (
                  <div
                    className="flex shrink-0 items-center"
                    data-nav-key={link.id}
                    key={link.id}
                  >
                    <NavRowLinkGhost
                      icon={link.icon}
                      label={t(link.labelKey)}
                    />
                  </div>
                ))}
                <div
                  className="flex shrink-0 items-center"
                  data-nav-key={OVERFLOW_TRIGGER_KEY}
                >
                  <NavOverflowTriggerGhost />
                </div>
              </div>
            </div>
          </div>

          {/* Seven utility controls: campus, locale, theme, search, cart, one
              CTA, account. Never collapsed. Search is an icon button like the
              cart: the bar is full at 1340px. */}
          <div
            className="hidden shrink-0 items-center gap-2 min-[1340px]:flex"
            inert={coveredBySearch}
          >
            <CampusPill />
            <LocaleSwitcher className="text-ink" size="sm" variant="ghost" />
            <ThemeSwitcher className="text-ink" size="sm" variant="ghost" />
            <SearchTrigger
              controls={SEARCH_PANEL_ID}
              expanded={searchLayout === "panel"}
              onOpen={() => openSearch("panel")}
              triggerRef={panelTriggerRef}
            />
            <CartButton
              count={cartCount}
              label={tShop("cart.title")}
              onOpen={openDrawer}
            />
            {/* The header's one primary CTA, and a real link. Shown only to
                someone who can act on it — signed in or not. */}
            {memberActive ? null : (
              <Link
                className="type-body-sm inline-flex shrink-0 items-center rounded-biso-pill bg-action px-4 py-2 font-semibold text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                href="/membership"
                onClick={() =>
                  trackEvent("membership_cta_click", { source: "nav" })
                }
              >
                {t("becomeMember")}
              </Link>
            )}
            <AccountMenu account={account} />
          </div>

          <div className="flex items-center gap-2 min-[1340px]:hidden">
            <SearchTrigger
              controls={SEARCH_SHEET_ID}
              expanded={searchLayout === "sheet"}
              onOpen={() => openSearch("sheet")}
              triggerRef={sheetTriggerRef}
            />
            <CartButton
              count={cartCount}
              label={tShop("cart.title")}
              onOpen={openDrawer}
            />
            <button
              aria-expanded={isMobileOpen}
              aria-label={isMobileOpen ? t("closeMenu") : t("openMenu")}
              className="rounded-biso-md p-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              onClick={() => setIsMobileOpen((open) => !open)}
              type="button"
            >
              {isMobileOpen ? (
                <X aria-hidden="true" className="size-6" />
              ) : (
                <Menu aria-hidden="true" className="size-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {openPanel && (
        <MegaPanel
          ariaLabel={t(`triggers.${openPanel}`)}
          id={`nav-panel-${openPanel}`}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          {openPanel === "students" && (
            <StudentsPanel featured={featured} onNavigate={closeNow} />
          )}
          {openPanel === "projects" && (
            <ProjectsPanel
              featured={featured}
              onNavigate={closeNow}
              projectLinks={projectLinks}
            />
          )}
          {openPanel === "about" && <AboutPanel onNavigate={closeNow} />}
        </MegaPanel>
      )}

      {searchLayout && (
        <QuickSearch
          campusId={activeCampusId}
          layout={searchLayout}
          locale={locale === "en" ? "en" : "no"}
          onClose={closeSearchFromInside}
        />
      )}

      {isMobileOpen && (
        // Capped at the viewport below the header and scrollable: the header
        // is fixed, so a drawer taller than the screen could not be scrolled
        // to its last controls.
        <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain border-edge border-t bg-surface min-[1340px]:hidden">
          <div className="px-4 pt-4">
            <CampusPill className="w-full justify-center" />
          </div>
          <MobileDrawer
            account={account}
            isMember={memberActive}
            onNavigate={closeMobile}
            projectLinks={projectLinks}
          />
        </div>
      )}
    </nav>
  );
}

function CartButton({
  count,
  label,
  onOpen,
}: {
  count: number;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="relative shrink-0 rounded-biso-md p-2 text-ink transition-colors hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      onClick={onOpen}
      type="button"
    >
      <ShoppingCart aria-hidden="true" className="size-5" />
      {count > 0 && (
        // Navy on sun in every surface. `text-ink` is white on the header's
        // navy surface, and white on the sun is unreadable.
        <span className="type-data absolute -top-0.5 -right-0.5 flex size-4 min-w-4 items-center justify-center rounded-biso-pill bg-marker px-1 text-[10px] text-deep">
          {count}
        </span>
      )}
    </button>
  );
}
