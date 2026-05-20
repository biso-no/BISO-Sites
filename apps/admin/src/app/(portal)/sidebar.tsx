"use client";

import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  Command,
  FileStack,
  FileText,
  Gift,
  HardDrive,
  Inbox,
  Layers,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Settings,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/actions/user";
import type { UserRolesForClient } from "@/lib/authorization";
import { hasNavAccess, type NavKey } from "@/lib/roles";
import { CampusSwitcher } from "./_components/campus-switcher";
import { SERIF_STACK, STUDIO } from "./_components/studio";

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

interface NavItem {
  group: "operate" | "publish";
  icon: React.ComponentType<{ size?: number }>;
  labelKey: string;
  navKey: NavKey;
  path: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    group: "operate",
    icon: LayoutDashboard,
    labelKey: "overview",
    navKey: "portal.dashboard",
    path: "/",
  },
  {
    group: "publish",
    icon: Briefcase,
    labelKey: "jobs",
    navKey: "portal.jobs",
    path: "/jobs",
  },
  {
    group: "publish",
    icon: Calendar,
    labelKey: "events",
    navKey: "portal.events",
    path: "/events",
  },
  {
    group: "publish",
    icon: Newspaper,
    labelKey: "news",
    navKey: "portal.news",
    path: "/news",
  },
  {
    group: "publish",
    icon: Gift,
    labelKey: "benefits",
    navKey: "portal.benefits",
    path: "/benefits",
  },
  {
    group: "publish",
    icon: ShoppingCart,
    labelKey: "shop",
    navKey: "portal.shop",
    path: "/shop",
  },
  {
    group: "publish",
    icon: Layers,
    labelKey: "pages",
    navKey: "portal.pages",
    path: "/pages",
  },
  {
    group: "operate",
    icon: Building2,
    labelKey: "departments",
    navKey: "portal.departments",
    path: "/departments",
  },
  {
    group: "operate",
    icon: FileText,
    labelKey: "documents",
    navKey: "portal.documents",
    path: "/documents",
  },
  {
    group: "operate",
    icon: HardDrive,
    labelKey: "it",
    navKey: "portal.it",
    path: "/it",
  },
  {
    group: "operate",
    icon: Inbox,
    labelKey: "submissions",
    navKey: "portal.submissions",
    path: "/submissions",
  },
];

function NavGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div>
      <p
        className="px-2 pt-3 pb-1.5 font-medium text-[10px] uppercase tracking-[0.08em]"
        style={{ color: STUDIO.ink4 }}
      >
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function Sidebar({ user, roles }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("adminPortal.nav");
  const tSidebar = useTranslations("adminPortal.sidebar");

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

  const publishItems = visibleItems.filter((item) => item.group === "publish");
  const operateItems = visibleItems.filter((item) => item.group === "operate");

  let currentCampus: string;
  if (roles.isGlobalAdmin) {
    currentCampus = roles.activeCampus ?? tSidebar("allCampuses");
  } else if (roles.isCampusAdmin) {
    currentCampus = roles.managedCampuses[0] ?? "";
  } else {
    currentCampus = roles.campusNames[0] ?? "";
  }

  return (
    <aside
      className="relative z-20 hidden h-screen w-60 shrink-0 flex-col p-3 md:flex"
      style={{
        background: "linear-gradient(180deg, #f6f0e3 0%, #f1ead9 100%)",
        borderRight: `0.5px solid ${STUDIO.rule}`,
        color: STUDIO.ink,
      }}
    >
      <div className="flex items-center justify-between px-2 pt-1 pb-4">
        <Link className="flex min-w-0 items-center gap-2.5" href="/">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xl"
            style={{
              background: STUDIO.ink,
              color: STUDIO.paper,
              fontFamily: SERIF_STACK,
              fontStyle: "italic",
            }}
          >
            B
          </span>
          <span className="min-w-0 leading-none">
            <span className="block truncate font-semibold text-[13px]">
              BISO Studio
            </span>
            <span
              className="mt-1 block truncate text-[10px] uppercase tracking-[0.06em]"
              style={{ color: STUDIO.ink3 }}
            >
              Admin
            </span>
          </span>
        </Link>
        <button
          aria-label={tSidebar("openCommandPalette")}
          className="flex items-center gap-1 rounded-md border px-1.5 py-1 font-mono text-[10px] transition hover:bg-white/80"
          onClick={() => window.dispatchEvent(new Event("admin:open-palette"))}
          style={{
            background: "rgba(255,255,255,0.52)",
            borderColor: STUDIO.rule2,
            color: STUDIO.ink3,
          }}
          type="button"
        >
          <Command size={11} /> K
        </button>
      </div>

      <CampusSwitcher
        availableCampuses={["Oslo", "Bergen", "Trondheim", "Stavanger"]}
        canSwitch={roles.isGlobalAdmin}
        currentCampus={currentCampus}
        roleLabel={user.roleLabel}
      />

      <nav className="min-h-0 flex-1 overflow-y-auto">
        <NavGroup title={t("publishGroup")}>
          {publishItems.map((item) => (
            <SidebarLink
              active={isActive(item.path)}
              href={item.path}
              icon={item.icon}
              key={item.path}
              label={t(item.labelKey)}
            />
          ))}
          {canViewDrafts && (
            <SidebarLink
              active={isActive("/drafts")}
              href="/drafts"
              icon={FileStack}
              label={t("drafts")}
            />
          )}
        </NavGroup>

        <NavGroup title={t("operateGroup")}>
          {operateItems.map((item) => (
            <SidebarLink
              active={isActive(item.path)}
              href={item.path}
              icon={item.icon}
              key={item.path}
              label={t(item.labelKey)}
            />
          ))}
          {canViewActivity && (
            <SidebarLink
              active={isActive("/activity")}
              href="/activity"
              icon={Activity}
              label={t("activity")}
            />
          )}
          {canViewSettings && (
            <SidebarLink
              active={isActive("/settings")}
              href="/settings"
              icon={Settings}
              label={t("settings")}
            />
          )}
        </NavGroup>
      </nav>

      <div className="mt-4 space-y-3">
        <div
          className="rounded-xl border p-3"
          style={{
            background: "rgba(255,255,255,0.48)",
            borderColor: STUDIO.rule2,
          }}
        >
          <p
            className="flex items-center gap-1.5 font-medium text-[10px] uppercase tracking-[0.08em]"
            style={{ color: STUDIO.ink3 }}
          >
            <Sparkles size={12} />
            {tSidebar("studioHint")}
          </p>
          <p
            className="mt-1 text-lg leading-5"
            style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
          >
            {tSidebar("hintText")}
          </p>
        </div>

        <div className="flex items-center gap-2 px-1 py-1">
          {user.avatar ? (
            <Image
              alt={user.name ?? "User"}
              className="h-8 w-8 rounded-full object-cover"
              height={32}
              src={user.avatar}
              width={32}
            />
          ) : (
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-semibold text-xs"
              style={{ background: STUDIO.claret, color: STUDIO.paper }}
            >
              {initials}
            </span>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate font-medium text-xs">
              {user.name ?? user.email ?? "User"}
            </p>
            <p className="truncate text-[10px]" style={{ color: STUDIO.ink3 }}>
              {user.roleLabel}
            </p>
          </div>
          <button
            aria-label={tSidebar("signOut")}
            className="rounded-md p-1.5 transition hover:bg-white/60"
            onClick={handleSignOut}
            style={{ color: STUDIO.ink3 }}
            type="button"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  active,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <Link
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition"
      href={href}
      style={
        active
          ? {
              background: STUDIO.ink,
              color: STUDIO.paper,
            }
          : { color: STUDIO.ink2 }
      }
    >
      <Icon size={15} />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}
