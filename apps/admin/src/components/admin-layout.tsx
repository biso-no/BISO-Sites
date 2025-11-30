"use client";

import { ModeToggle } from "@repo/ui/components/mode-toggle";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { signOut } from "@/lib/actions/user";
import { AssistantSidebar } from "./assistant/assistant-sidebar";
import { AssistantTrigger } from "./assistant/assistant-trigger";
import Breadcrumb from "./breadcrumb";
import { CommandMenu } from "./command-menu";
import { LocaleSwitcher } from "./locale-switcher";
import { NotificationsDropdown } from "./notifications/notifications-dropdown";
import { RoleSwitcher } from "./role-switcher";

type AdminLayoutProps = {
  children: ReactNode;
  roles: string[];
  firstName: string;
};

type NavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  roles: string[];
  subItems?: { href: string; label: string; roles?: string[] }[];
};

const SidebarItem = ({
  item,
  isActive,
  isExpanded,
  pathname,
}: {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  pathname: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (item.subItems) {
      setIsOpen(
        item.subItems.some((subItem) => pathname.startsWith(subItem.href))
      );
    }
  }, [pathname, item.subItems]);

  return (
    <motion.li
      animate={{
        scale: isActive ? 1.01 : 1,
      }}
      className="group relative mb-1 rounded-2xl px-2 py-1"
      initial={false}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl px-2 py-2 transition-all duration-200 ease-out",
          isActive
            ? "bg-primary/10 text-primary shadow-sm dark:bg-white/15 dark:text-white dark:shadow-[0_15px_35px_-25px_rgba(0,0,0,0.8)] dark:backdrop-blur"
            : "text-muted-foreground hover:bg-primary/5 hover:text-primary dark:text-white/70 dark:hover:bg-white/5 dark:hover:text-white"
        )}
      >
        <Link className="flex flex-1 items-center gap-3" href={item.href}>
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl font-medium text-sm transition-colors",
              isActive
                ? "bg-white text-primary shadow-sm dark:bg-white/25 dark:text-white/95"
                : "bg-transparent text-muted-foreground dark:bg-white/5 dark:text-white/75"
            )}
          >
            <item.icon className="h-4 w-4" />
          </span>
          {isExpanded && (
            <motion.span
              animate={{ opacity: 1, x: 0 }}
              className="font-medium text-sm"
              exit={{ opacity: 0, x: -12 }}
              initial={{ opacity: 0, x: -12 }}
            >
              {item.label}
            </motion.span>
          )}
        </Link>
        {item.subItems && isExpanded && (
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-primary/5 hover:text-primary dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                isOpen && "rotate-90"
              )}
            />
          </button>
        )}
      </div>
      {item.subItems && isExpanded && (
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.ul
              animate={{ height: "auto", opacity: 1 }}
              className="mt-2 ml-7 space-y-1 border-primary/10 border-l pl-4 dark:border-white/10"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
            >
              {item.subItems.map((subItem) => {
                const isSubActive = pathname === subItem.href;
                return (
                  <motion.li
                    animate={{ x: 0, opacity: 1 }}
                    initial={{ x: -12, opacity: 0 }}
                    key={subItem.href}
                  >
                    <Link
                      className={cn(
                        "flex items-center rounded-xl px-3 py-2 font-medium text-xs transition-colors",
                        isSubActive
                          ? "bg-primary/10 text-primary dark:bg-white/15 dark:text-white dark:shadow-inner"
                          : "text-muted-foreground hover:bg-primary/5 hover:text-primary dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                      )}
                      href={subItem.href}
                    >
                      {subItem.label}
                    </Link>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      )}
    </motion.li>
  );
};

export function AdminLayout({ children, roles, firstName }: AdminLayoutProps) {
  const t = useTranslations("admin");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const pathname = usePathname();
  const [selectedRole, setSelectedRole] = useState(
    roles.includes("Admin") ? "Admin" : roles[0] || ""
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const openAssistant = useCallback(() => {
    setIsAssistantOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsAssistantOpen(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const toggleSidebar = () => setIsSidebarExpanded(!isSidebarExpanded);

  const navItems: NavItem[] = [
    {
      href: "/admin",
      icon: LayoutDashboard,
      label: t("navigation.dashboard"),
      roles: ["Admin"],
    },
    {
      href: "/admin/pages",
      icon: FileText,
      label: t("navigation.pages"),
      roles: ["Admin", "pr"],
    },
    {
      href: "/admin/posts",
      icon: FileText,
      label: t("navigation.posts"),
      roles: ["Admin", "pr"],
    },
    {
      href: "/admin/shop",
      icon: Store,
      label: t("navigation.shop"),
      roles: ["Admin", "finance"],
      subItems: [
        {
          href: "/admin/shop/orders",
          label: t("shopSubItems.orders"),
          roles: ["Admin", "finance"],
        },
        {
          href: "/admin/shop/products",
          label: t("shopSubItems.products"),
          roles: ["Admin", "finance"],
        },
        {
          href: "/admin/shop/customers",
          label: t("shopSubItems.customers"),
          roles: ["Admin", "finance"],
        },
        {
          href: "/admin/shop/settings",
          label: t("shopSubItems.settings"),
          roles: ["Admin"],
        },
      ],
    },
    {
      href: "/admin/expenses",
      icon: CalendarIcon,
      label: t("navigation.expenses"),
      roles: ["Admin", "finance"],
    },
    {
      href: "/admin/jobs",
      icon: Users,
      label: t("navigation.jobs"),
      roles: ["Admin", "hr", "pr"],
      subItems: [
        {
          href: "/admin/jobs",
          label: t("jobsSubItems.allJobs"),
          roles: ["Admin", "hr", "pr"],
        },
        {
          href: "/admin/jobs/applications",
          label: t("jobsSubItems.applications"),
          roles: ["Admin", "hr", "pr"],
        },
      ],
    },
    {
      href: "/admin/events",
      icon: CalendarIcon,
      label: t("navigation.events"),
      roles: ["Admin", "pr"],
      subItems: [
        {
          href: "/admin/events",
          label: t("eventsSubItems.allEvents"),
          roles: ["Admin", "pr"],
        },
        {
          href: "/admin/events/new",
          label: t("eventsSubItems.createEvent"),
          roles: ["Admin", "pr"],
        },
      ],
    },
    {
      href: "/admin/units",
      icon: Building2,
      label: t("navigation.units"),
      roles: ["Admin", "hr", "finance", "pr"],
    },
    {
      href: "/admin/users",
      icon: Users,
      label: t("navigation.users"),
      roles: ["Admin", "hr", "finance"],
    },
    {
      href: "/admin/varsling",
      icon: Shield,
      label: t("navigation.varsling"),
      roles: ["Admin"],
    },
    {
      href: "/admin/settings",
      icon: Settings,
      label: t("navigation.settings"),
      roles: ["Admin"],
      subItems: [
        {
          href: "/admin/settings",
          label: t("settingsSubItems.navigation"),
          roles: ["Admin"],
        },
        {
          href: "/admin/settings/profile",
          label: t("settingsSubItems.profile"),
          roles: ["Admin"],
        },
        {
          href: "/admin/settings/security",
          label: t("settingsSubItems.security"),
          roles: ["Admin"],
        },
      ],
    },
  ];

  const hasAccess = (itemRoles: string[]) =>
    selectedRole ? itemRoles.includes(selectedRole) : false;

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-linear-to-br from-primary-10/25 via-slate-50 to-secondary-10/40 dark:from-background dark:via-card dark:to-background">
      {/* Background Effects */}
      <div className="pointer-events-none absolute inset-0 bg-grid-primary-soft opacity-40 dark:opacity-20" />
      <div className="-left-20 pointer-events-none absolute top-[-18%] h-72 w-72 rounded-full bg-secondary-20/60 blur-[140px] dark:bg-primary/30" />
      <div className="pointer-events-none absolute right-[-10%] bottom-[-25%] h-80 w-80 rounded-full bg-gold-muted/45 blur-[160px] dark:bg-secondary-100/20" />

      {/* Sidebar */}
      <motion.nav
        animate={{ width: isSidebarExpanded ? 268 : 88 }}
        className="relative z-10 m-4 flex shrink-0 flex-col overflow-hidden rounded-[26px] border border-primary/10 bg-white/80 text-foreground shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-[#001731]/95 dark:text-white dark:shadow-[0_45px_80px_-45px_rgba(0,23,49,0.9)]"
        initial={false}
      >
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(61,169,224,0.15),transparent_60%)] dark:bg-[radial-gradient(circle_at_top,rgba(61,169,224,0.25),transparent_60%)]" />

        {/* Sidebar Header */}
        <motion.div
          animate={{
            justifyContent: isSidebarExpanded ? "flex-start" : "center",
          }}
          className="flex items-center gap-3 px-4 pt-5 pb-4"
          initial={false}
        >
          <Link
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-semibold text-lg text-primary tracking-tight dark:bg-white/10 dark:text-white"
            href="/admin"
          >
            B
          </Link>
          {isSidebarExpanded && (
            <div className="space-y-0.5">
              <span className="text-muted-foreground text-xs uppercase tracking-[0.2em] dark:text-white/60">
                {t("title")}
              </span>
              <span className="font-semibold text-base text-foreground leading-none dark:text-white">
                {t("subtitle")}
              </span>
            </div>
          )}
        </motion.div>

        {/* Role Badge */}
        <div className="px-4">
          <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 dark:border-white/10 dark:bg-white/10">
            <p className="text-[0.65rem] text-muted-foreground uppercase tracking-[0.24em] dark:text-white/60">
              {t("activeRole")}
            </p>
            <p className="font-medium text-foreground text-sm dark:text-white">
              {selectedRole}
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <ul className="mt-6 flex-1 space-y-1 overflow-y-auto px-2 pb-6">
          <AnimatePresence mode="wait">
            {navItems.map((item) => {
              if (!hasAccess(item.roles)) {
                return null;
              }
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin" || pathname === "/admin/"
                  : pathname.startsWith(item.href);

              return (
                <SidebarItem
                  isActive={isActive}
                  isExpanded={isSidebarExpanded}
                  item={item}
                  key={item.href}
                  pathname={pathname}
                />
              );
            })}
          </AnimatePresence>
        </ul>

        {/* Sidebar Footer */}
        <div className="space-y-3 px-4 pb-4">
          <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-muted-foreground text-xs dark:border-white/10 dark:bg-white/10 dark:text-white/70">
            <p className="font-semibold text-foreground dark:text-white">
              {t("supportLine")}
            </p>
            <p className="mt-1 text-muted-foreground dark:text-white/70">
              it@biso.no
            </p>
          </div>
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center rounded-2xl border border-primary/10 bg-white/50 font-medium text-foreground/80 text-sm transition hover:bg-white/80 dark:border-white/10 dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/20"
            onClick={toggleSidebar}
          >
            <motion.div
              animate={{ rotate: isSidebarExpanded ? 0 : 180 }}
              transition={{ duration: 0.25 }}
            >
              <ChevronLeft className="h-5 w-5" />
            </motion.div>
            {isSidebarExpanded && <span className="ml-2">{t("collapse")}</span>}
          </button>
        </div>
      </motion.nav>

      {/* Main Content Area */}
      <div className="relative z-10 m-4 ml-0 flex flex-1 flex-col overflow-hidden rounded-[32px] bg-white/85 shadow-[0_45px_80px_-60px_rgba(0,23,49,0.35)] backdrop-blur-xl dark:border-primary/20 dark:bg-card/85 dark:shadow-[0_45px_80px_-60px_rgba(61,169,224,0.15)]">
        {/* Header */}
        <header className="flex shrink-0 flex-col gap-4 bg-white/85 px-6 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:gap-6 lg:px-10 dark:border-primary/20 dark:bg-card/85">
          <div className="flex flex-col gap-2">
            <span className="text-primary-60 text-xs uppercase tracking-[0.22em]">
              {isLoading ? t("loading") : t("welcome")}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-2xl text-primary-100">
                {isLoading ? <Skeleton className="h-8 w-32" /> : firstName}
              </span>
              {roles.includes("Admin") && (
                <RoleSwitcher
                  roles={roles}
                  selectedRole={selectedRole}
                  setSelectedRole={setSelectedRole}
                />
              )}
            </div>
            <div className="rounded-full border border-primary/10 bg-primary/5 px-4 py-1 font-medium text-primary-70 text-xs dark:border-primary/20 dark:bg-primary/10 dark:text-primary">
              <Breadcrumb />
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <LocaleSwitcher />
            <CommandMenu />
            <NotificationsDropdown />
            <AssistantTrigger onClick={openAssistant} />
            <ModeToggle />
            <Avatar className="h-10 w-10 border border-primary/10 shadow-sm dark:border-primary/20">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${firstName}`}
              />
              <AvatarFallback>{firstName.charAt(0)}</AvatarFallback>
            </Avatar>
            <Button
              className="h-10 w-10 rounded-xl border border-primary/10 bg-primary-10/60 text-primary-80 hover:bg-primary/10 dark:border-primary/20 dark:bg-card/70 dark:text-primary dark:hover:bg-primary/15"
              disabled={isLoading}
              onClick={handleSignOut}
              size="icon"
              variant="ghost"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "linear",
                  }}
                >
                  <LogOut className="h-5 w-5" />
                </motion.div>
              ) : (
                <LogOut className="h-5 w-5" />
              )}
            </Button>
          </div>
        </header>

        {/* Main Content with Single Scrollbar */}
        <main className="relative flex-1 overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary-10/18 via-transparent to-secondary-10/30" />
          <div className="h-full overflow-y-auto px-6 py-6 lg:px-10 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* AI Assistant Sidebar */}
      <AssistantSidebar isOpen={isAssistantOpen} onClose={closeAssistant} />
    </div>
  );
}
