"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { Menu, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { useUserMembership } from "@/components/context/membership-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { CampusPill } from "@/components/ui/campus-pill";
import { useCart } from "@/lib/contexts/cart-context";
import type { NavAccount, NavFeatured } from "@/lib/types/nav";
import { AccountMenu } from "./account-menu";
import { DesktopMenu } from "./desktop-menu";
import { MegaPanel } from "./mega-panel";
import { MobileDrawer } from "./mobile-drawer";
import { AboutPanel } from "./panels/about-panel";
import { ProjectsPanel } from "./panels/projects-panel";
import { StudentsPanel } from "./panels/students-panel";
import { useMegaPanels } from "./use-mega-panels";

/**
 * The redesigned header.
 *
 * **Panel behaviour is unchanged.** Hover intent, `ArrowDown`, `Escape` and
 * outside-click all come from `useMegaPanels`, the same hook the current header
 * uses — not a copy. RD-017 restyles the header; it does not rewrite the best
 * keyboard handling in the codebase.
 *
 * What did change (`00-current-state.md` §8.3, `01-design-spec.md` §3.5):
 *   - **Nine utility controls become six.** The member portal moves into the
 *     account menu; "Apply verv" goes, because Jobs is now a top-level nav
 *     item; "Partner" moves into the About panel. One primary CTA remains.
 *     The theme toggle stays here as `<ThemeSwitcher>`, beside the locale
 *     switcher: this comment used to say it moved into the account menu, it
 *     never did, and for an anonymous visitor that menu is a plain sign-in
 *     button — so a control placed there would not exist for most traffic.
 *   - **Desktop starts at `lg` (1024px), not `xl` (1280px).** Every laptop
 *     under 1280px was getting the hamburger.
 *   - **Three `router.push()` buttons become real `<Link>`s**, restoring
 *     prefetch, middle-click and open-in-new-tab.
 *   - **Solid on scroll, no `backdrop-blur`** — the design system has no
 *     glassmorphism.
 *   - **Campus is a labelled pill**, not a ghost dropdown fourth in a row of
 *     icons, and each option links to a real `/campus/<slug>` URL.
 *
 * PLACEHOLDER-001: the logo lockup wants the BISO chevron as a vector. Only a
 * PNG exists, so the existing asset is used until an SVG is supplied.
 */
interface NavigationV2Props {
  account?: NavAccount | null;
  featured?: NavFeatured;
  isMember?: boolean;
}

const EMPTY_FEATURED: NavFeatured = { event: null, project: null, news: null };

export function NavigationV2({
  account = null,
  featured = EMPTY_FEATURED,
  isMember,
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
  const t = useTranslations("common.navigation");
  const tShop = useTranslations("shop");
  const cartCount = getItemCount();
  const closeMobile = useCallback(() => setIsMobileOpen(false), []);

  const solid = isScrolled || openPanel !== null;

  return (
    <nav
      className={[
        "fixed top-0 right-0 left-0 z-50 transition-colors duration-200",
        // Solid navy rather than a translucent blur. `data-surface="deep"`
        // flips --ink/--action/--edge so nothing inside branches on surface.
        solid ? "bg-surface shadow-elev-1" : "bg-transparent",
      ].join(" ")}
      data-surface="deep"
      ref={navRef}
    >
      <div className="mx-auto w-full max-w-biso-wide px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">
          <Link
            className="relative block h-11 w-[clamp(140px,12vw,190px)] shrink-0 rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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

          {/* The desktop bar appears only once it fits.
              Re-measured at the 1340px breakpoint: logo 161px
              (`clamp(140,12vw,190)`) + menu 516px (Norwegian, its intrinsic
              width — the items do not shrink) + utilities 595px (`shrink-0`)
              + two 16px gaps = 1304px inside a bar that is the viewport less
              64px of padding. **The 547px in the previous version of this note
              was stale** — it predates the theme switcher joining the row.
              The real gutter is **4px at 1340 and 27px at 1366**: nothing
              clips or overflows, but the row is full, and a seventh control
              here would have to displace something. That is why the link to a
              campus's page lives in the "For students" panel rather than
              beside the campus filter. Below ~1300px the menu box was
              squeezed while its contents kept their size and painted straight
              over the campus pill, locale switcher and Shop link — from 1024px
              (where `lg:` turned the bar on) up to about 1340px, in both
              locales. The drawer covers that range instead.

              `flex-1` is gone with it: a growing box whose contents cannot
              shrink is what made the failure silent, because nothing ever
              overflowed the page and no width probe could see it. Both groups
              are `shrink-0` now, so the next item that does not fit pushes the
              bar wider than the viewport, where a horizontal-overflow check
              catches it. */}
          <div className="hidden shrink-0 justify-start min-[1340px]:flex">
            <DesktopMenu
              onPanelEnter={openPanelNow}
              onPanelFocus={handleTriggerFocus}
              onPanelKeyDown={handleTriggerKeyDown}
              onPanelPointerDown={handleTriggerPointerDown}
              onPanelToggle={togglePanel}
              onStandaloneEnter={closeNow}
              openPanel={openPanel}
              registerTrigger={registerTrigger}
            />
          </div>

          {/* Six utility controls: campus, locale, theme, cart, one CTA,
              account. */}
          <div className="hidden shrink-0 items-center gap-2 min-[1340px]:flex">
            <CampusPill />
            <LocaleSwitcher className="text-ink" size="sm" variant="ghost" />
            <ThemeSwitcher className="text-ink" size="sm" variant="ghost" />
            <CartButton
              count={cartCount}
              label={tShop("cart.title")}
              onOpen={openDrawer}
            />
            {/* The header's one primary CTA, and a real link. */}
            <Link
              className="type-body-sm inline-flex shrink-0 items-center rounded-biso-pill bg-action px-4 py-2 font-medium text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href="/membership"
            >
              {t("becomeMember")}
            </Link>
            <AccountMenu account={account} />
          </div>

          <div className="flex items-center gap-2 min-[1340px]:hidden">
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
            <ProjectsPanel featured={featured} onNavigate={closeNow} />
          )}
          {openPanel === "about" && <AboutPanel onNavigate={closeNow} />}
        </MegaPanel>
      )}

      {isMobileOpen && (
        <div className="border-edge border-t bg-surface min-[1340px]:hidden">
          <div className="px-4 py-4">
            <CampusPill className="mb-4 w-full justify-center" />
          </div>
          <MobileDrawer
            account={account}
            isMember={isMember ?? memberFromContext}
            onNavigate={closeMobile}
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
        <span className="type-data absolute -top-0.5 -right-0.5 flex size-4 min-w-4 items-center justify-center rounded-biso-pill bg-marker px-1 text-[10px] text-ink">
          {count}
        </span>
      )}
    </button>
  );
}
