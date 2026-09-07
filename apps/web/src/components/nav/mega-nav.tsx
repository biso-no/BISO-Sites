"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { ImageWithFallback } from "@repo/ui/components/image";
import { ModeToggle } from "@repo/ui/components/mode-toggle";
import { Button } from "@repo/ui/components/ui/button";
import { Menu, ShoppingCart, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCampus } from "@/components/context/campus";
import { useUserMembership } from "@/components/context/membership-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SelectCampus } from "@/components/select-campus";
import { useCart } from "@/lib/contexts/cart-context";
import type { NavAccount, NavFeatured } from "@/lib/types/nav";
import { AccountMenu } from "./account-menu";
import { DesktopMenu } from "./desktop-menu";
import { MegaPanel } from "./mega-panel";
import { MobileDrawer } from "./mobile-drawer";
import type { PanelId } from "./nav-config";
import { AboutPanel } from "./panels/about-panel";
import { ProjectsPanel } from "./panels/projects-panel";
import { StudentsPanel } from "./panels/students-panel";

const SCROLL_THRESHOLD = 50;
const CLOSE_DELAY_MS = 120;
const EMPTY_FEATURED: NavFeatured = { event: null, project: null, news: null };

interface NavigationProps {
  /** Resolved server-side; `null` for anonymous visitors. */
  account?: NavAccount | null;
  featured?: NavFeatured;
  isMember?: boolean;
}

export function Navigation({
  account = null,
  featured = EMPTY_FEATURED,
  isMember,
}: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const { campuses } = useCampus();
  const { isMember: memberFromContext } = useUserMembership();
  const { getItemCount, openDrawer } = useCart();
  const router = useRouter();
  const t = useTranslations("common.navigation");
  const tShop = useTranslations("shop");

  const cartCount = getItemCount();
  const memberActive = isMember ?? memberFromContext;

  const navRef = useRef<HTMLElement | null>(null);
  const triggerRefs = useRef<Record<PanelId, HTMLButtonElement | null>>({
    students: null,
    projects: null,
    about: null,
  });
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openPanelRef = useRef<PanelId | null>(null);
  const pointerInteractionRef = useRef(false);

  useEffect(() => {
    openPanelRef.current = openPanel;
  }, [openPanel]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPanelNow = useCallback(
    (id: PanelId) => {
      clearCloseTimer();
      setOpenPanel(id);
    },
    [clearCloseTimer]
  );

  const closeNow = useCallback(() => {
    clearCloseTimer();
    setOpenPanel(null);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(
      () => setOpenPanel(null),
      CLOSE_DELAY_MS
    );
  }, [clearCloseTimer]);

  const togglePanel = useCallback(
    (id: PanelId) => {
      clearCloseTimer();
      // Fire only on the open transition, never on close.
      if (openPanelRef.current !== id) {
        trackEvent("nav_menu_open", { panel: id });
      }
      setOpenPanel((current) => (current === id ? null : id));
      pointerInteractionRef.current = false;
    },
    [clearCloseTimer]
  );

  const handleTriggerPointerDown = useCallback(() => {
    pointerInteractionRef.current = true;
  }, []);

  const handleTriggerFocus = useCallback(
    (id: PanelId) => {
      // Open only on keyboard focus, not the focus that follows a pointer click
      // (which would race the click toggle and immediately reclose the panel).
      if (!pointerInteractionRef.current) {
        openPanelNow(id);
      }
    },
    [openPanelNow]
  );

  const focusFirstPanelLink = useCallback((id: PanelId) => {
    requestAnimationFrame(() => {
      const panel = document.getElementById(`nav-panel-${id}`);
      panel?.querySelector<HTMLElement>("a, button")?.focus();
    });
  }, []);

  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, id: PanelId) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        openPanelNow(id);
        focusFirstPanelLink(id);
      } else if (event.key === "Escape") {
        closeNow();
      }
    },
    [openPanelNow, focusFirstPanelLink, closeNow]
  );

  const registerTrigger = useCallback(
    (id: PanelId, el: HTMLButtonElement | null) => {
      triggerRefs.current[id] = el;
    },
    []
  );

  const closeMobile = useCallback(() => setIsMobileOpen(false), []);

  // Sticky/scroll background.
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Escape closes the panel + returns focus to its trigger; pointer-down outside
  // the nav root closes any open panel.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const current = openPanelRef.current;
      if (event.key === "Escape" && current) {
        closeNow();
        triggerRefs.current[current]?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        openPanelRef.current &&
        navRef.current &&
        !navRef.current.contains(event.target as Node)
      ) {
        closeNow();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [closeNow]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const hasSolidBackground = isScrolled || openPanel !== null;

  return (
    <motion.nav
      animate={{ y: 0 }}
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        hasSolidBackground
          ? "bg-nav-background shadow-brand/10 shadow-lg backdrop-blur-lg"
          : "bg-transparent"
      }`}
      initial={{ y: -100 }}
      onMouseLeave={scheduleClose}
      ref={navRef}
    >
      <div className="mx-auto w-full max-w-[min(1536px,100%)] px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-3 sm:gap-4">
          {/* Logo */}
          <motion.div
            className="shrink-0"
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            whileHover={{ scale: 1.02 }}
          >
            <Link
              className="relative block h-11 w-[clamp(148px,12vw,200px)]"
              href="/"
            >
              <ImageWithFallback
                alt="BISO logo"
                className="object-contain object-left"
                fill
                priority
                sizes="(max-width: 640px) 42vw, (max-width: 1024px) 22vw, 200px"
                src="/images/home-logo.png"
              />
            </Link>
          </motion.div>

          {/* Desktop trigger row */}
          <div className="hidden min-w-0 flex-1 justify-start xl:flex">
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

          {/* Right-side utility cluster */}
          <div className="hidden shrink-0 items-center gap-1.5 xl:flex 2xl:gap-2">
            <SelectCampus
              campuses={campuses}
              className="text-white"
              size="sm"
              variant="ghost"
            />
            <ModeToggle className="text-white" />
            <LocaleSwitcher className="text-white" size="sm" variant="ghost" />
            <button
              aria-label={tShop("cart.title")}
              className="relative shrink-0 rounded-lg p-2 text-white transition-colors hover:text-brand"
              onClick={openDrawer}
              type="button"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 font-bold text-[10px] text-brand-dark">
                  {cartCount}
                </span>
              )}
            </button>
            <Link
              className="hidden shrink-0 whitespace-nowrap px-2 text-sm text-white hover:text-brand 2xl:inline"
              href="/business"
            >
              {t("partner")}
            </Link>
            {!account && (
              <Button
                className="shrink-0 border-brand bg-transparent text-white hover:bg-brand hover:text-white"
                onClick={() => router.push("/member")}
                size="sm"
                variant="outline"
              >
                {t("memberPortal")}
              </Button>
            )}
            <Button
              className="hidden shrink-0 border-brand bg-transparent text-white hover:bg-brand hover:text-white 2xl:inline-flex"
              onClick={() => router.push("/jobs")}
              size="sm"
              variant="outline"
            >
              {t("applyVerv")}
            </Button>
            <Button
              className="shrink-0 bg-brand text-white hover:bg-brand/90"
              onClick={() => {
                trackEvent("membership_cta_click", { source: "nav" });
                router.push("/membership");
              }}
              size="sm"
            >
              {t("becomeMember")}
            </Button>
            <AccountMenu account={account} />
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-2 xl:hidden">
            <button
              aria-label={tShop("cart.title")}
              className="relative rounded-lg p-2 text-white transition-colors hover:text-brand"
              onClick={openDrawer}
              type="button"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 font-bold text-[10px] text-brand-dark">
                  {cartCount}
                </span>
              )}
            </button>
            <ModeToggle className="text-white" />
            <Button
              aria-expanded={isMobileOpen}
              aria-label={isMobileOpen ? t("closeMenu") : t("openMenu")}
              className="rounded-lg p-2 text-white"
              onClick={() => setIsMobileOpen((open) => !open)}
              variant="ghost"
            >
              {isMobileOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop mega panels */}
      <AnimatePresence>
        {openPanel && (
          <MegaPanel
            ariaLabel={t(`triggers.${openPanel}`)}
            id={`nav-panel-${openPanel}`}
            key={openPanel}
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
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="border-brand-border border-t bg-nav-background backdrop-blur-lg xl:hidden"
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
          >
            <MobileDrawer
              account={account}
              isMember={memberActive}
              onNavigate={closeMobile}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
