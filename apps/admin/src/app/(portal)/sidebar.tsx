"use client";

import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  Command,
  FileStack,
  Gift,
  Layers,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/actions/user";
import type { UserRolesForClient } from "@/lib/authorization";
import { hasNavAccess, type NavKey } from "@/lib/roles";

interface SidebarUser {
  avatar: string | null;
  email: string | null;
  id: string;
  name: string | null;
  roleLabel: string;
}

interface SidebarProps {
  roles: UserRolesForClient;
  user: SidebarUser;
}

const NAV_ITEMS: Array<{
  path: string;
  labelKey: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    style?: React.CSSProperties;
  }>;
  navKey: NavKey;
}> = [
  {
    path: "/",
    labelKey: "overview",
    icon: LayoutDashboard,
    navKey: "portal.dashboard",
  },
  {
    path: "/pages",
    labelKey: "pages",
    icon: Layers,
    navKey: "portal.pages",
  },
  {
    path: "/departments",
    labelKey: "departments",
    icon: Building2,
    navKey: "portal.departments",
  },
  {
    path: "/jobs",
    labelKey: "jobs",
    icon: Briefcase,
    navKey: "portal.jobs",
  },
  {
    path: "/events",
    labelKey: "events",
    icon: Calendar,
    navKey: "portal.events",
  },
  {
    path: "/shop",
    labelKey: "shop",
    icon: ShoppingCart,
    navKey: "portal.shop",
  },
  {
    path: "/benefits",
    labelKey: "benefits",
    icon: Gift,
    navKey: "portal.benefits",
  },
  {
    path: "/news",
    labelKey: "news",
    icon: Newspaper,
    navKey: "portal.news",
  },
];

export function Sidebar({ user, roles }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("adminPortal.nav");

  const visibleItems = NAV_ITEMS.filter((item) =>
    hasNavAccess(item.navKey, roles.roles, roles.hasDepartmentMembership)
  );

  const canViewActivity = hasNavAccess(
    "portal.activity",
    roles.roles,
    roles.hasDepartmentMembership
  );
  const canViewDrafts = hasNavAccess(
    "portal.drafts",
    roles.roles,
    roles.hasDepartmentMembership
  );
  const canViewSettings = hasNavAccess(
    "portal.settings",
    roles.roles,
    roles.hasDepartmentMembership
  );

  function isActive(path: string) {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <div
      className="relative z-20 flex h-screen w-72 flex-col"
      style={{
        borderRight: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,10,22,0.80)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {/* Brand */}
      <div className="flex items-center justify-between p-8">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full shadow-[0_0_15px_rgba(61,169,224,0.4)]"
            style={{
              background: "linear-gradient(135deg,#3DA9E0,#001731)",
            }}
          >
            <span className="font-bold text-white text-xs tracking-tighter">
              BI
            </span>
          </div>
          <span className="font-semibold text-lg text-white tracking-wide">
            SO OS
          </span>
        </div>
        <div
          className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs"
          style={{
            color: "rgba(255,255,255,0.40)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <Command size={12} /> K
        </div>
      </div>

      {/* Main nav */}
      <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-4">
        {visibleItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              className="group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
              href={item.path}
              key={item.path}
            >
              {active && (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 rounded-xl"
                  initial={{ opacity: 0 }}
                  layoutId="portal-sidebar-active"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                  transition={{ duration: 0.2 }}
                />
              )}
              {active && (
                <div
                  className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full"
                  style={{
                    background: "#3DA9E0",
                    boxShadow: "0 0 10px #3DA9E0",
                  }}
                />
              )}
              <item.icon
                className="relative z-10 transition-colors"
                size={18}
                style={{ color: active ? "#3DA9E0" : "rgba(255,255,255,0.40)" }}
              />
              <span
                className="relative z-10 font-medium text-sm transition-colors"
                style={{ color: active ? "#fff" : "rgba(255,255,255,0.50)" }}
              >
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}

        {/* Secondary items */}
        {(canViewDrafts || canViewActivity) && (
          <div
            className="my-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          />
        )}

        {canViewDrafts && (
          <Link
            className="group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
            href="/drafts"
          >
            {isActive("/drafts") && (
              <motion.div
                className="absolute inset-0 rounded-xl"
                layoutId="portal-sidebar-active"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              />
            )}
            <FileStack
              className="relative z-10"
              size={18}
              style={{
                color: isActive("/drafts")
                  ? "#3DA9E0"
                  : "rgba(255,255,255,0.40)",
              }}
            />
            <span
              className="relative z-10 font-medium text-sm"
              style={{
                color: isActive("/drafts")
                  ? "#fff"
                  : "rgba(255,255,255,0.50)",
              }}
            >
              {t("drafts")}
            </span>
          </Link>
        )}

        {canViewActivity && (
          <Link
            className="group relative flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
            href="/activity"
          >
            {isActive("/activity") && (
              <motion.div
                className="absolute inset-0 rounded-xl"
                layoutId="portal-sidebar-active"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              />
            )}
            <Activity
              className="relative z-10"
              size={18}
              style={{
                color: isActive("/activity")
                  ? "#3DA9E0"
                  : "rgba(255,255,255,0.40)",
              }}
            />
            <span
              className="relative z-10 font-medium text-sm"
              style={{
                color: isActive("/activity")
                  ? "#fff"
                  : "rgba(255,255,255,0.50)",
              }}
            >
              {t("activity")}
            </span>
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div
        className="p-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        {canViewSettings && (
          <Link
            className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
            href="/settings"
            style={{ color: "rgba(255,255,255,0.50)" }}
          >
            <Settings size={18} />
            <span className="font-medium text-sm">{t("settings")}</span>
          </Link>
        )}

        <div
          className="mt-2 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {user.avatar ? (
            <Image
              alt={user.name ?? "User"}
              className="h-9 w-9 rounded-full object-cover"
              height={36}
              src={user.avatar}
              style={{ border: "1px solid rgba(255,255,255,0.10)" }}
              width={36}
            />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-xs"
              style={{
                background: "rgba(61,169,224,0.20)",
                color: "#3DA9E0",
                border: "1px solid rgba(61,169,224,0.30)",
              }}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm text-white">
              {user.name ?? user.email ?? "User"}
            </p>
            <p
              className="truncate font-mono text-xs"
              style={{ color: "#3DA9E0" }}
            >
              {user.roleLabel}
            </p>
          </div>
          <button
            aria-label="Sign out"
            className="transition-colors"
            onClick={handleSignOut}
            style={{ color: "rgba(255,255,255,0.40)" }}
            type="button"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
