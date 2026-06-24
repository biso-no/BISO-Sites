"use client";
import { ImageWithFallback } from "@repo/ui/components/image";
import { ModeToggle } from "@repo/ui/components/mode-toggle";
import { Button } from "@repo/ui/components/ui/button";
import {
  Briefcase,
  Calendar,
  Info,
  Menu,
  Newspaper,
  ShoppingBag,
  ShoppingCart,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useCampus } from "@/components/context/campus";
import { SelectCampus } from "@/components/select-campus";
import { useCart } from "@/lib/contexts/cart-context";
import { LocaleSwitcher } from "../locale-switcher";

interface NavigationProps {
  isMember?: boolean;
  onApplyClick?: () => void;
  onEventsClick?: () => void;
  onNewsClick?: () => void;
  onShopClick?: () => void;
}

export function Navigation({
  onEventsClick,
  onNewsClick,
  onApplyClick,
  onShopClick,
  isMember,
}: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { campuses } = useCampus();
  const { getItemCount, openDrawer } = useCart();
  const cartCount = getItemCount();
  const pathname = usePathname();
  const t = useTranslations("common.navigation");
  const tShop = useTranslations("shop");
  const router = useRouter();
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (href: string) => pathname === href;

  const navItems = useMemo(
    () => [
      { icon: Users, label: t("campus"), href: "/campus", onClick: undefined },
      {
        icon: Calendar,
        label: t("events"),
        href: "/events",
        onClick: onEventsClick,
      },
      {
        icon: Newspaper,
        label: t("news"),
        href: "/news",
        onClick: onNewsClick,
      },
      {
        icon: ShoppingBag,
        label: t("shop"),
        href: "/shop",
        onClick: onShopClick,
      },
      {
        icon: Briefcase,
        label: t("applyHere"),
        href: "/jobs",
        onClick: onApplyClick,
        highlight: true,
      },
      //{ icon: Mail, label: 'Contact', href: '#contact', onClick: undefined },
      { icon: Info, label: t("about"), href: "#about", onClick: undefined },
    ],
    [onApplyClick, onEventsClick, onNewsClick, onShopClick, t]
  );

  return (
    <motion.nav
      animate={{ y: 0 }}
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-nav-background shadow-brand/10 shadow-lg backdrop-blur-lg"
          : "bg-transparent"
      }`}
      initial={{ y: -100 }}
    >
      <div className="mx-auto w-full max-w-[min(1400px,100%)] px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 flex-nowrap items-center justify-between gap-3 sm:gap-4">
          {/* Keep logo box constrained so nav has enough room on desktop */}
          <motion.div
            className="shrink-0"
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            whileHover={{ scale: 1.02 }}
          >
            <Link
              className="relative block h-11 w-[clamp(148px,15vw,240px)]"
              href="/"
            >
              <ImageWithFallback
                alt="BISO logo"
                className="object-contain object-left"
                fill
                priority
                sizes="(max-width: 640px) 42vw, (max-width: 1024px) 22vw, 240px"
                src="/images/home-logo.png"
              />
            </Link>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="flex flex-nowrap items-center justify-end gap-x-1.5 gap-y-0 text-sm lg:gap-x-2 lg:text-[0.95rem]">
              {navItems.map((item) => (
                <Link
                  className={`flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg py-2 transition-colors duration-300 hover:text-brand ${
                    isActive(item.href)
                      ? "border border-brand-border-strong bg-linear-to-r from-brand-muted-strong to-brand-muted-strong px-3 hover:from-brand-muted-strong hover:to-brand-muted-strong"
                      : "px-1.5"
                  } ${isScrolled ? "text-white" : "text-white"}`}
                  href={item.href}
                  key={item.label}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                >
                  <item.icon
                    aria-hidden
                    className="h-4 w-4 shrink-0 opacity-90 lg:h-4.5 lg:w-4.5"
                  />
                  {item.label}
                </Link>
              ))}
              <div className="mx-1 flex shrink-0 items-center gap-1.5 border-white/15 border-l pl-2 lg:mx-1.5 lg:gap-2 lg:pl-3">
                <SelectCampus
                  campuses={campuses}
                  className="text-white"
                  size="sm"
                  variant="ghost"
                />
                <ModeToggle className="text-white" />
                <LocaleSwitcher
                  className="text-white"
                  size="sm"
                  variant="ghost"
                />
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
                  className="shrink-0 whitespace-nowrap text-white hover:text-brand"
                  href="/business"
                >
                  {t("partner")}
                </Link>
                <Button
                  className="shrink-0 border-brand bg-transparent text-white hover:bg-brand hover:text-white"
                  onClick={() => router.push("/member")}
                  size="sm"
                  variant="outline"
                >
                  {t("memberPortal")}
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
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
              className={`rounded-lg p-2 transition-colors duration-300 ${
                isScrolled ? "text-white" : "text-white"
              }`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              variant="ghost"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            animate={{ opacity: 1, height: "auto" }}
            className="border-brand-border border-t bg-nav-background backdrop-blur-lg md:hidden"
            exit={{ opacity: 0, height: 0 }}
            initial={{ opacity: 0, height: 0 }}
          >
            <div className="space-y-4 px-4 py-6">
              {navItems.map((item) => (
                <Link
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-white transition-colors hover:bg-brand-muted ${
                    isActive(item.href)
                      ? "border border-brand-border-strong bg-linear-to-r from-brand-muted-strong to-brand-muted-strong hover:from-brand-muted-strong hover:to-brand-muted-strong"
                      : ""
                  }`}
                  href={item.href}
                  key={item.label}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              ))}
              <SelectCampus campuses={campuses} className="w-full text-white" />
              <LocaleSwitcher
                className="w-full text-white"
                size="sm"
                variant="ghost"
              />
              {isMember && (
                <Button
                  className="w-full border-brand bg-transparent text-white hover:bg-brand hover:text-white"
                  onClick={() => router.push("/member")}
                  variant="outline"
                >
                  {t("memberPortal")}
                </Button>
              )}
              {!isMember && (
                <Button
                  className="w-full border-brand bg-transparent text-white hover:bg-brand hover:text-white"
                  onClick={() => router.push("/member")}
                  variant="outline"
                >
                  {t("becomeMember")}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
