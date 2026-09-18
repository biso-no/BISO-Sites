"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { ImageWithFallback } from "@repo/ui/components/image";
import { ModeToggle } from "@repo/ui/components/mode-toggle";
import { Button } from "@repo/ui/components/ui/button";
import {
  Briefcase,
  Building2,
  Menu,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  type KeyboardEvent,
  type ReactNode,
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
import { DesktopMenu, NavRowLink } from "./desktop-menu";
import { MegaPanel } from "./mega-panel";
import { MobileDrawer } from "./mobile-drawer";
import {
  AUTH_ONLY_OVERFLOW_KEYS,
  hasSolidNavRoute,
  NAV_OVERFLOW_DROP_ORDER,
  OVERFLOW_TRIGGER_KEY,
  type PanelId,
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
import { useNavOverflow } from "./use-nav-overflow";

const SCROLL_THRESHOLD = 50;
const CLOSE_DELAY_MS = 120;
const EMPTY_FEATURED: NavFeatured = { event: null, project: null, news: null };

/**
 * Shared by the row and its measurement ghost. They must resolve to the same
 * typography or the ghost measures a different string than the row will draw —
 * inheriting the 16px body size instead of this one made every text item ~5px
 * too wide, and the row collapsed an item earlier than it had to.
 */
const ROW_CLASS = "flex items-center gap-1 text-[0.92rem]";

const STANDALONE_ICONS = new Map(
  STANDALONE_LINKS.map((link) => [link.id, link.icon])
);

/** One item in the measured desktop row. */
interface RowItem {
  /**
   * Set when the item may be surrendered to the overflow menu; this is how it
   * renders once it has been. Items without an entry never collapse.
   */
  entry?: OverflowEntry;
  key: string;
  node: ReactNode;
  /** Pushes this item and everything after it to the right edge. */
  startsCluster?: boolean;
}

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
  const pathname = usePathname();
  const t = useTranslations("common.navigation");
  const tShop = useTranslations("shop");

  const cartCount = getItemCount();
  const memberActive = isMember ?? memberFromContext;
  const locale = useLocale();

  // Which items the overflow menu is allowed to take, narrowed to the ones this
  // visitor actually has. `signature` re-triggers measurement when the item set
  // or the label language changes — neither alters the row's own width, so the
  // width observer would not notice.
  const dropOrder = NAV_OVERFLOW_DROP_ORDER.filter(
    (key) => account !== null || !AUTH_ONLY_OVERFLOW_KEYS.includes(key)
  );
  const { ghostRef, hiddenKeys, rowRef } = useNavOverflow({
    dropOrder,
    signature: `${locale}|${account ? "auth" : "anon"}|${memberActive ? "member" : "guest"}`,
  });
  const hiddenKeySet = new Set(hiddenKeys);

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

  const hasSolidBackground =
    isScrolled || openPanel !== null || hasSolidNavRoute(pathname);

  const cartButton = (
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
  );

  // The desktop row, in display order. Items carrying an `entry` may be moved
  // into the overflow menu; the rest are load-bearing and always rendered. The
  // "…" trigger and the account menu are appended at render time because the
  // trigger only exists once something is hidden.
  const desktopItems: RowItem[] = [
    {
      key: "triggers",
      node: (
        <DesktopMenu
          onPanelEnter={openPanelNow}
          onPanelFocus={handleTriggerFocus}
          onPanelKeyDown={handleTriggerKeyDown}
          onPanelPointerDown={handleTriggerPointerDown}
          onPanelToggle={togglePanel}
          openPanel={openPanel}
          registerTrigger={registerTrigger}
        />
      ),
    },
    ...STANDALONE_LINKS.map((link) => ({
      entry: {
        href: link.href,
        icon: STANDALONE_ICONS.get(link.id),
        key: link.id,
        label: t(link.labelKey),
      },
      key: link.id,
      node: (
        <NavRowLink
          href={link.href}
          icon={link.icon}
          label={t(link.labelKey)}
          onActivate={closeNow}
        />
      ),
    })),
    {
      key: "campus",
      node: (
        <SelectCampus
          campuses={campuses}
          className="text-white"
          size="sm"
          variant="ghost"
        />
      ),
      startsCluster: true,
    },
    { key: "theme", node: <ModeToggle className="text-white" /> },
    {
      key: "locale",
      node: <LocaleSwitcher className="text-white" size="sm" variant="ghost" />,
    },
    { key: "cart", node: cartButton },
    {
      entry: {
        href: "/business",
        icon: Building2,
        key: "partner",
        label: t("partner"),
      },
      key: "partner",
      node: (
        <NavRowLink
          href="/business"
          label={t("partner")}
          onActivate={closeNow}
        />
      ),
    },
  ];

  /*
    Signed-in only. `account` is non-null exactly when `getLoggedInUser()`
    resolved an *authenticated* account — `isAuthenticatedAccount()` requires an
    email, or a real (non `guest_`) name plus a verified email — so anonymous
    Appwrite sessions never satisfy it and never see this button.

    This condition was previously `!account`, which rendered the button
    precisely for signed-out visitors.
  */
  if (account) {
    desktopItems.push({
      entry: {
        href: "/member",
        icon: Sparkles,
        key: "memberPortal",
        label: t("memberPortal"),
      },
      key: "memberPortal",
      node: (
        <Button
          className="shrink-0 border-brand bg-transparent text-white hover:bg-brand hover:text-white"
          onClick={() => router.push("/member")}
          size="sm"
          variant="outline"
        >
          {t("memberPortal")}
        </Button>
      ),
    });
  }

  desktopItems.push({
    entry: {
      href: "/jobs",
      icon: Briefcase,
      key: "applyVerv",
      label: t("applyVerv"),
    },
    key: "applyVerv",
    node: (
      <Button
        className="shrink-0 border-brand bg-transparent text-white hover:bg-brand hover:text-white"
        onClick={() => router.push("/jobs")}
        size="sm"
        variant="outline"
      >
        {t("applyVerv")}
      </Button>
    ),
  });

  // Members are already members — the CTA is only ever shown to someone who can
  // act on it, signed in or not. Same rule as the mobile drawer.
  if (!memberActive) {
    desktopItems.push({
      key: "becomeMember",
      node: (
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
      ),
    });
  }

  const overflowEntries = desktopItems
    .filter((item) => item.entry && hiddenKeySet.has(item.key))
    .map((item) => item.entry as OverflowEntry);

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

          {/*
            One flat flex line — logo aside, every desktop item is a direct
            child with a uniform gap, so `useNavOverflow` can decide what fits
            with plain arithmetic instead of guessing at breakpoints. The old
            two-zone layout (`flex-1` triggers beside a `shrink-0` cluster)
            could not shrink: every item is `whitespace-nowrap shrink-0`, so the
            trigger row simply overflowed and painted underneath the cluster.
          */}
          <div className="relative hidden min-w-0 flex-1 xl:block">
            <div className={`${ROW_CLASS} min-w-0`} ref={rowRef}>
              {desktopItems.map((item) =>
                hiddenKeySet.has(item.key) ? null : (
                  <div
                    className={`flex shrink-0 items-center ${
                      item.startsCluster ? "ml-auto" : ""
                    }`}
                    data-nav-key={item.key}
                    key={item.key}
                  >
                    {item.node}
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
              <div
                className="flex shrink-0 items-center"
                data-nav-key="account"
              >
                <AccountMenu account={account} />
              </div>
            </div>

            {/*
              Measurement ghost: an item sitting in the overflow menu is not in
              the row to be measured, and the "…" trigger does not exist until
              something is hidden. This invisible copy keeps every width that
              the decision depends on permanently available — and, being real
              DOM rather than a cached number, it stays correct when the font
              loads or the locale changes the labels.
            */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
              inert
            >
              <div className={`${ROW_CLASS} invisible`} ref={ghostRef}>
                {desktopItems
                  .filter((item) => item.entry)
                  .map((item) => (
                    <div
                      className="flex shrink-0 items-center"
                      data-nav-key={item.key}
                      key={item.key}
                    >
                      {item.node}
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
