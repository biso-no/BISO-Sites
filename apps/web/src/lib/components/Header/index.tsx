"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowUpRight, ChevronDown, Menu, Search, Sparkles } from "lucide-react";
import { getCampuses } from "@/app/actions/campus";

import { getNavItems, type NavTreeItem } from "@/lib/actions/main/actions";
import { SelectCampus } from "@/components/select-campus";
import { Button } from "@repo/ui/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@repo/ui/components/ui/sheet";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Campus } from "@/lib/types/campus";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/components/ui/accordion";
import { SUPPORTED_LOCALES, type Locale } from "@/i18n/config";
import { cn } from '@repo/ui/lib/utils';
import { Badge } from "@repo/ui/components/ui/badge";
import { CartButton } from "@/components/cart/cart-button";

type NavDocument = NavTreeItem;

const PRIMARY_ACTIONS = [
  {
    href: "/membership",
    label: "Bli medlem",
    icon: Sparkles,
  }
];

const deriveHref = (item: NavDocument, editMode: boolean) => {
  if (editMode) return "#";
  return item.href || item.path || item.url || "/";
};

const isExternalLink = (item: NavDocument) => {
  if (typeof item.isExternal === "boolean") {
    return item.isExternal;
  }
  const candidate = item.href || item.url || "";
  return candidate.startsWith("http");
};

export const Header = ({ editMode }: { editMode: boolean }) => {
  const pathname = (usePathname() || "/").replace("/edit", "");
  const localeFromHook = useLocale();
  const resolvedLocale = useMemo<Locale>(() => {
    const candidate = localeFromHook as Locale;
    return SUPPORTED_LOCALES.includes(candidate) ? candidate : "no";
  }, [localeFromHook]);
  const [navItems, setNavItems] = useState<NavDocument[]>([]);
  const [loadingNav, setLoadingNav] = useState(true);
  const [campuses, setCampuses] = useState<Campus[]>([]);

  useEffect(() => {
    const fetchCampuses = async () => {
      const response = await getCampuses();
      setCampuses(response);
    };
    fetchCampuses();
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchNav = async () => {
      try {
        setLoadingNav(true);
        const response = await getNavItems(resolvedLocale);
        if (!isMounted) return;
        setNavItems(
          Array.isArray(response?.items) ? (response.items as NavDocument[]) : []
        );
      } catch (error) {
        console.error("Failed to fetch navigation", error);
        if (isMounted) {
          setNavItems([]);
        }
      } finally {
        if (isMounted) {
          setLoadingNav(false);
        }
      }
    };

    fetchNav();
    return () => {
      isMounted = false;
    };
  }, [resolvedLocale]);

  const desktopNav = useMemo(() => navItems.slice(0, 8), [navItems]);

  const matchPathname = useCallback(
    (href: string | undefined, external: boolean) => {
      if (!href || href === "#" || external) return false;
      if (href === "/") {
        return pathname === "/";
      }
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname]
  );

  const isItemActive = (item: NavDocument): boolean => {
    const activeSelf = matchPathname(deriveHref(item, editMode), isExternalLink(item));
    if (activeSelf) return true;
    return item.children.some((child) => isItemActive(child));
  };

  const renderDesktopChildLinks = (children: NavDocument[], depth = 0) => (
    <div className="flex flex-col gap-1">
      {children.map((child) => {
        const href = deriveHref(child, editMode);
        const external = isExternalLink(child);
        const active = isItemActive(child);
        const hasNested = child.children.length > 0;

        const linkClasses = cn(
          "flex items-center justify-between rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary-40 shadow-card-soft"
            : "text-primary-80 hover:bg-primary/5 hover:text-primary-40"
        );

        const linkLabel = (
          <span className="flex items-center gap-2">
            {child.title}
            {hasNested && <ChevronDown className="h-3 w-3 opacity-60" />}
          </span>
        );

        const linkNode = external ? (
          <a key={child.id} href={href} className={linkClasses} target="_blank" rel="noreferrer">
            {linkLabel}
          </a>
        ) : (
          <Link key={child.id} href={href} className={linkClasses}>
            {linkLabel}
          </Link>
        );

        return (
          <div key={child.id} className="flex flex-col gap-1">
            {linkNode}
            {hasNested && (
              <div className="ml-3 border-l border-primary/10 pl-3">
                {renderDesktopChildLinks(child.children, depth + 1)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const indentClass = (depth: number) => {
    if (depth <= 0) return "";
    if (depth === 1) return "pl-4";
    if (depth === 2) return "pl-6";
    return "pl-8";
  };

  const renderMobileChildLinks = (children: NavDocument[], depth = 0) => (
    <div className="flex flex-col gap-2">
      {children.map((child) => {
        const href = deriveHref(child, editMode);
        const external = isExternalLink(child);
        const active = isItemActive(child);
        const hasNested = child.children.length > 0;
        const linkClasses = cn(
          "text-sm font-medium text-primary-80 transition hover:text-primary-30",
          active && "text-primary-40"
        );

        const linkNode = external ? (
          <a href={href} className={linkClasses} target="_blank" rel="noreferrer">
            {child.title}
          </a>
        ) : (
          <Link href={href} className={linkClasses}>
            {child.title}
          </Link>
        );

        return (
          <div key={child.id} className={cn("flex flex-col gap-2", indentClass(depth))}>
            {linkNode}
            {hasNested && (
              <div className="pl-3 border-l border-primary/10">
                {renderMobileChildLinks(child.children, depth + 1)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      <div className="container-page relative mx-auto flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/images/logo-home.png" alt="BISO logo" width={148} height={38} priority />
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {loadingNav ? (
            <div className="flex items-center gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-6 w-16 rounded-full bg-primary/10" />
              ))}
            </div>
          ) : (
            desktopNav.map((item) => {
              const href = deriveHref(item, editMode);
              const external = isExternalLink(item);
              const active = isItemActive(item);
              const hasChildren = item.children.length > 0;

              const linkContent = (
                <span
                  className={cn(
                    "group flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    active ? "text-foreground" : "text-foreground/70 hover:text-foreground"
                  )}
                >
                  {item.title}
                  {hasChildren && <ChevronDown className="h-3 w-3 opacity-70" />}
                </span>
              );

              const linkNode = external ? (
                <a href={href} className="group relative flex items-center" target="_blank" rel="noreferrer">
                  {linkContent}
                </a>
              ) : (
                <Link href={href} className="group relative flex items-center">
                  {linkContent}
                </Link>
              );

              return (
                <div key={item.id} className="group relative">
                  {linkNode}
                  {hasChildren && (
                    <div className="invisible absolute left-1/2 top-full z-40 mt-3 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background p-4 opacity-0 shadow-sm transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                      <div className="relative flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs uppercase tracking-[0.14em]">
                            {item.title}
                          </Badge>
                          <ArrowUpRight className="h-4 w-4 text-primary-50" />
                        </div>
                        {renderDesktopChildLinks(item.children)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        <div className="ml-auto hidden items-center gap-2 xl:flex">
          <SelectCampus
            placeholder="Velg campus"
            className="h-10 rounded-full border border-primary/15 bg-white px-4 text-sm font-medium text-primary-80 shadow-sm hover:border-primary/25"
            campuses={campuses}
          />
          <LocaleSwitcher
            variant="ghost"
            size="sm"
            className="h-10 rounded-full border border-primary/15 bg-white px-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary-70 hover:bg-primary/5"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 rounded-full border border-primary/10 text-primary-80 hover:border-primary/30 hover:bg-primary/5 md:inline-flex"
          >
            <Search className="h-4 w-4" />
            <span className="sr-only">Søk</span>
          </Button>
          <CartButton className="hidden h-10 w-10 rounded-full border border-primary/10 text-primary-80 hover:border-primary/30 hover:bg-primary/5 md:inline-flex" />
          <div className="hidden items-center gap-2 md:flex">
            {PRIMARY_ACTIONS.map((action) => (
              <Button
                key={action.href}
                asChild
                size="sm"
                className="group h-10 rounded-full bg-primary-100/95 px-4 text-sm font-semibold text-white shadow-card-soft hover:bg-primary-90"
              >
                <Link href={action.href} className="flex items-center gap-2">
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full border border-primary/15 bg-white/90 text-primary-100 shadow-sm lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Åpne meny</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-sm border-l border-primary/10 bg-surface-strong/95 px-0 pb-12 pt-8 backdrop-blur">
              <div className="flex flex-col gap-6 px-6">
                <div className="flex items-center justify-between">
                  <CartButton className="h-10 w-10 rounded-full border border-primary/15 bg-white/80 text-primary-80 hover:border-primary/30 hover:bg-primary/5" />
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-primary/15 bg-white text-primary-80 hover:border-primary/30 hover:bg-primary/5">
                    <Search className="h-4 w-4" />
                    <span className="sr-only">Søk</span>
                  </Button>
                </div>
                <div className="flex flex-col gap-3">
                  <Badge variant="gradient" className="w-max rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em]">
                    Studentliv
                  </Badge>
                  <p className="text-base font-semibold text-primary-90">Naviger BISO-universet</p>
                </div>
                <SelectCampus className="rounded-2xl border-primary/20 bg-white" campuses={campuses} />
                <LocaleSwitcher className="w-full rounded-2xl border border-primary/20 bg-white py-2 text-primary-80" />
                <div className="flex flex-wrap gap-2">
                  {PRIMARY_ACTIONS.map((action) => (
                    <Button
                      key={action.href}
                      asChild
                      size="sm"
                      className="flex-1 rounded-xl bg-primary-100/90 text-white shadow-card-soft hover:bg-primary-90"
                    >
                      <Link href={action.href} className="flex items-center justify-center gap-2">
                        <action.icon className="h-4 w-4" />
                        {action.label}
                      </Link>
                    </Button>
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  {loadingNav ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full rounded-xl bg-primary/10" />
                    ))
                  ) : (
                    <Accordion type="multiple" className="w-full space-y-2">
                      {navItems.map((item) => {
                        const href = deriveHref(item, editMode);
                        const external = isExternalLink(item);
                        const hasChildren = item.children.length > 0;
                        const active = isItemActive(item);

                        const linkClasses = cn(
                          "flex w-full items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-primary-80 transition hover:bg-primary/5 hover:text-primary-40",
                          active && "bg-primary/5 text-primary-40"
                        );

                        if (!hasChildren) {
                          return (
                            <div key={item.id} className="w-full">
                              {external ? (
                                <a href={href} className={linkClasses} target="_blank" rel="noreferrer">
                                  {item.title}
                                </a>
                              ) : (
                                <Link href={href} className={linkClasses}>
                                  {item.title}
                                </Link>
                              )}
                            </div>
                          );
                        }

                        return (
                          <AccordionItem key={item.id} value={item.id} className="overflow-hidden rounded-xl border border-primary/10">
                            <AccordionTrigger
                              className={cn(
                                linkClasses,
                                "px-4 py-3 text-left font-semibold data-[state=open]:bg-primary/5 data-[state=open]:text-primary-40"
                              )}
                            >
                              <span className="flex-1 text-left">{item.title}</span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="flex flex-col gap-2 border-t border-primary/10 bg-white/80 px-4 py-3 dark:bg-surface-card">
                                {renderMobileChildLinks(item.children, 1)}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}
                </div>

                <div className="grid gap-3 border-t border-primary/10 pt-4 text-sm font-medium text-primary-70">
                  <Link href="/membership" className="flex items-center justify-between rounded-xl border border-primary/10 bg-white/70 px-4 py-2 hover:border-primary/20 hover:text-primary-40">
                    Bli medlem
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <Link href="/jobs" className="flex items-center justify-between rounded-xl border border-primary/10 bg-white/70 px-4 py-2 hover:border-primary/20 hover:text-primary-40">
                    Søk verv
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <Link href="/contact" className="flex items-center justify-between rounded-xl border border-primary/10 bg-white/70 px-4 py-2 hover:border-primary/20 hover:text-primary-40">
                    Kontakt oss
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
