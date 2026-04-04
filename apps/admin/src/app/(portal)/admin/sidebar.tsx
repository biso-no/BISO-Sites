"use client";

import { motion } from "motion/react";
import {
  LayoutDashboard,
  Layers,
  Building2,
  Briefcase,
  Calendar,
  ShoppingCart,
  Gift,
  Newspaper,
  Settings,
  LogOut,
  Command,
  FileStack,
  Activity,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/actions/user";
import { hasNavAccess, type NavKey } from "@/lib/roles";
import type { UserRolesForClient } from "@/lib/authorization";

type SidebarUser = {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  roleLabel: string;
};

type SidebarProps = {
  user: SidebarUser;
  roles: UserRolesForClient;
};

const NAV_ITEMS: Array<{
  path: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  navKey: NavKey;
}> = [
  {
    path: "/admin",
    labelKey: "overview",
    icon: LayoutDashboard,
    navKey: "portal.dashboard",
  },
  {
    path: "/admin/pages",
    labelKey: "pages",
    icon: Layers,
    navKey: "portal.pages",
  },
  {
    path: "/admin/departments",
    labelKey: "departments",
    icon: Building2,
    navKey: "portal.departments",
  },
  {
    path: "/admin/jobs",
    labelKey: "jobs",
    icon: Briefcase,
    navKey: "portal.jobs",
  },
  {
    path: "/admin/events",
    labelKey: "events",
    icon: Calendar,
    navKey: "portal.events",
  },
  {
    path: "/admin/shop",
    labelKey: "shop",
    icon: ShoppingCart,
    navKey: "portal.shop",
  },
  {
    path: "/admin/benefits",
    labelKey: "benefits",
    icon: Gift,
    navKey: "portal.benefits",
  },
  {
    path: "/admin/news",
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
    hasNavAccess(
      item.navKey,
      roles.roles,
      roles.hasDepartmentMembership
    )
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
    if (path === "/admin") return pathname === "/admin";
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
      className="w-72 h-screen flex flex-col relative z-20"
      style={{
        borderRight: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(0,10,22,0.80)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {/* Brand */}
      <div className="p-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(61,169,224,0.4)]"
            style={{
              background: "linear-gradient(135deg,#3DA9E0,#001731)",
            }}
          >
            <span className="text-white font-bold text-xs tracking-tighter">
              BI
            </span>
          </div>
          <span className="text-white font-semibold tracking-wide text-lg">
            SO OS
          </span>
        </div>
        <div
          className="flex items-center gap-1 text-xs font-mono rounded-md px-2 py-1"
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
      <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className="relative flex items-center gap-3 px-4 py-3 rounded-xl group transition-all"
            >
              {active && (
                <motion.div
                  layoutId="portal-sidebar-active"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}
              {active && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                  style={{
                    background: "#3DA9E0",
                    boxShadow: "0 0 10px #3DA9E0",
                  }}
                />
              )}
              <item.icon
                size={18}
                className="relative z-10 transition-colors"
                style={{ color: active ? "#3DA9E0" : "rgba(255,255,255,0.40)" }}
              />
              <span
                className="relative z-10 text-sm font-medium transition-colors"
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
            href="/admin/drafts"
            className="relative flex items-center gap-3 px-4 py-3 rounded-xl group transition-all"
          >
            {isActive("/admin/drafts") && (
              <motion.div
                layoutId="portal-sidebar-active"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              />
            )}
            <FileStack
              size={18}
              className="relative z-10"
              style={{
                color: isActive("/admin/drafts")
                  ? "#3DA9E0"
                  : "rgba(255,255,255,0.40)",
              }}
            />
            <span
              className="relative z-10 text-sm font-medium"
              style={{
                color: isActive("/admin/drafts")
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
            href="/admin/activity"
            className="relative flex items-center gap-3 px-4 py-3 rounded-xl group transition-all"
          >
            {isActive("/admin/activity") && (
              <motion.div
                layoutId="portal-sidebar-active"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              />
            )}
            <Activity
              size={18}
              className="relative z-10"
              style={{
                color: isActive("/admin/activity")
                  ? "#3DA9E0"
                  : "rgba(255,255,255,0.40)",
              }}
            />
            <span
              className="relative z-10 text-sm font-medium"
              style={{
                color: isActive("/admin/activity")
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
            href="/admin/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
            style={{ color: "rgba(255,255,255,0.50)" }}
          >
            <Settings size={18} />
            <span className="text-sm font-medium">{t("settings")}</span>
          </Link>
        )}

        <div
          className="mt-2 flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name ?? "User"}
              className="w-9 h-9 rounded-full object-cover"
              style={{ border: "1px solid rgba(255,255,255,0.10)" }}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: "rgba(61,169,224,0.20)",
                color: "#3DA9E0",
                border: "1px solid rgba(61,169,224,0.30)",
              }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {user.name ?? user.email ?? "User"}
            </p>
            <p
              className="text-xs font-mono truncate"
              style={{ color: "#3DA9E0" }}
            >
              {user.roleLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="transition-colors"
            style={{ color: "rgba(255,255,255,0.40)" }}
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
