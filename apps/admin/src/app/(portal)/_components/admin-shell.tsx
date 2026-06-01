"use client";

import { ChevronLeft, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NotificationsPanel } from "@/components/notifications/notifications-panel";
import type { UserRolesForClient } from "@/lib/authorization";
import { NAV_ITEMS, Sidebar } from "../sidebar";
import { AssistantWidget } from "./assistant/assistant-widget";
import { CommandPalette } from "./command-palette";
import { STUDIO } from "./studio";

interface AdminShellUser {
  avatar: string | null;
  email: string | null;
  id: string;
  name: string | null;
  roleLabel: string;
}

interface AdminShellProps {
  children: React.ReactNode;
  roles: UserRolesForClient;
  user: AdminShellUser;
}

function getCrumbKeys(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return ["overview"];
  }
  return segments;
}

export function AdminShell({ children, user, roles }: AdminShellProps) {
  const pathname = usePathname();
  const t = useTranslations("adminPortal.nav");
  const tSidebar = useTranslations("adminPortal.sidebar");
  const tAdmin = useTranslations("admin");
  const crumbs = getCrumbKeys(pathname);

  return (
    <div
      className="grid h-screen w-full overflow-hidden md:grid-cols-[15rem_1fr]"
      style={{
        background: STUDIO.paper,
        color: STUDIO.ink,
      }}
    >
      <Sidebar roles={roles} user={user} />

      <div className="flex h-screen min-w-0 flex-col overflow-hidden">
        <header
          className="sticky top-0 z-20 flex h-[52px] shrink-0 items-center gap-3 px-4 md:px-6"
          style={{
            background: "rgba(250,247,242,0.88)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderBottom: `0.5px solid ${STUDIO.rule}`,
          }}
        >
          <Link
            aria-label={tSidebar("back")}
            className="grid h-8 w-8 place-items-center rounded-lg border md:hidden"
            href="/"
            style={{
              background: "rgba(255,255,255,0.55)",
              borderColor: STUDIO.rule2,
              color: STUDIO.ink3,
            }}
          >
            <ChevronLeft size={16} />
          </Link>

          <nav
            aria-label="Breadcrumb"
            className="hidden min-w-0 items-center gap-2 text-sm md:flex"
            style={{ color: STUDIO.ink3 }}
          >
            <Link className="shrink-0" href="/">
              BISO Studio
            </Link>
            {crumbs.map((crumb, index) => {
              const href = `/${crumbs.slice(0, index + 1).join("/")}`;
              const navItem = NAV_ITEMS.find((item) => item.path === href);
              const label = navItem ? t(navItem.labelKey) : formatCrumb(crumb);
              return (
                <span className="flex min-w-0 items-center gap-2" key={href}>
                  <span style={{ color: STUDIO.ink4 }}>›</span>
                  <Link
                    className="truncate"
                    href={href === "/overview" ? "/" : href}
                    style={{
                      color:
                        index === crumbs.length - 1 ? STUDIO.ink : STUDIO.ink3,
                      fontWeight: index === crumbs.length - 1 ? 500 : 400,
                    }}
                  >
                    {label}
                  </Link>
                </span>
              );
            })}
          </nav>

          <button
            className="ml-auto hidden h-8 w-72 cursor-pointer items-center gap-2 rounded-lg border px-3 text-xs transition md:flex"
            onClick={() =>
              window.dispatchEvent(new Event("admin:open-palette"))
            }
            style={{
              background: "rgba(255,255,255,0.58)",
              borderColor: STUDIO.rule2,
              color: STUDIO.ink4,
            }}
            type="button"
          >
            <Search size={13} />
            <span
              className="min-w-0 flex-1 text-left"
              style={{ color: STUDIO.ink4 }}
            >
              {tAdmin("commandMenuPlaceholder")}
            </span>
            <span
              className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
              style={{ borderColor: STUDIO.rule2, color: STUDIO.ink3 }}
            >
              ⌘K
            </span>
          </button>

          <NotificationsPanel roles={roles} />
        </header>

        <main className="portal-scrollbar min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto min-h-full max-w-[1640px] px-5 py-7 md:px-9 md:py-9">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette roles={roles} />
      <AssistantWidget roles={roles} user={user} />

      <style>{`
        .portal-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .portal-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .portal-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(26,24,20,0.16);
          border-radius: 10px;
        }
        .portal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(26,24,20,0.26);
        }
      `}</style>
    </div>
  );
}

function formatCrumb(value: string) {
  if (value === "it") {
    return "IT";
  }
  if (value === "new") {
    return "New";
  }
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
