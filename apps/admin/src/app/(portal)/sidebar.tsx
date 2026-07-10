"use client";

import { ChevronDown, Command, LogOut, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "@/lib/actions/user";
import type { UserRolesForClient } from "@/lib/authorization";
import {
  filterNavTree,
  findActivePath,
  type NavGroup as NavGroupNode,
} from "@/lib/nav-tree";
import { hasNavAccess, type NavKey } from "@/lib/roles";
import { OPEN_ASSISTANT_EVENT } from "./_components/assistant/assistant-widget";
import { CampusSwitcher } from "./_components/campus-switcher";
import { useInboxCounts } from "./_components/inbox-realtime-provider";
import { SERIF_STACK, STUDIO } from "./_components/studio";

interface SidebarUser {
  avatar: string | null;
  email: string | null;
  id: string;
  name: string | null;
  roleLabel: string;
}

interface SidebarProps {
  inboxCount: number;
  roles: UserRolesForClient;
  user: SidebarUser;
}

export function Sidebar({ user, roles, inboxCount }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("adminPortal.nav");
  const tSidebar = useTranslations("adminPortal.sidebar");
  const liveCounts = useInboxCounts();
  const liveInboxCount = liveCounts?.total ?? inboxCount;

  const tree = useMemo(
    () =>
      filterNavTree({
        hasDepartmentMembership: roles.hasDepartmentMembership,
        roles: roles.roles,
      }),
    [roles]
  );

  const activePath = findActivePath(pathname);
  const activeGroupId = useMemo(() => {
    for (const node of tree) {
      if (
        node.kind === "group" &&
        node.children.some((child) => child.path === activePath)
      ) {
        return node.id;
      }
    }
    return null;
  }, [tree, activePath]);

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const expandedGroup = openGroup ?? activeGroupId;

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

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pt-2">
        {tree.map((node) =>
          node.kind === "leaf" ? (
            <SidebarLink
              active={activePath === node.path}
              badge={node.path === "/inbox" ? liveInboxCount : undefined}
              href={node.path}
              icon={node.icon}
              key={node.path}
              label={t(node.labelKey)}
            />
          ) : (
            <SidebarGroup
              activePath={activePath}
              expanded={expandedGroup === node.id}
              key={node.id}
              label={t(node.labelKey)}
              node={node}
              onToggle={() =>
                setOpenGroup((prev) => (prev === node.id ? null : node.id))
              }
              t={t}
            />
          )
        )}
      </nav>

      <div className="mt-4 space-y-3">
        <button
          className="flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] transition hover:bg-white/70"
          onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))}
          style={{
            background: "rgba(255,255,255,0.48)",
            borderColor: STUDIO.rule2,
            color: STUDIO.ink2,
          }}
          type="button"
        >
          <Sparkles size={14} style={{ color: STUDIO.ink3, flexShrink: 0 }} />
          <span className="flex-1 truncate">{tSidebar("openAssistant")}</span>
          <kbd
            className="rounded border px-1 font-mono text-[9px]"
            style={{ borderColor: STUDIO.rule2, color: STUDIO.ink4 }}
          >
            ✦
          </kbd>
        </button>
        <StudioHintCarousel
          hints={tSidebar.raw("hints") as string[]}
          label={tSidebar("studioHint")}
          roles={roles}
        />

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

// Parallel to the `hints` array in the i18n messages — one entry per hint.
// An empty object means the hint is visible to everyone.
const HINT_ACCESS: Array<{ navKey?: NavKey; globalAdminOnly?: true }> = [
  {}, // ⌘K — everyone
  { navKey: "portal.jobs" }, // AI Norwegian draft
  { navKey: "portal.jobs" }, // AI screening
  { navKey: "portal.jobs" }, // Scheduled publish
  { navKey: "portal.jobs" }, // Pipeline drag & bulk-move
  { navKey: "portal.events" }, // Event waitlists
  { navKey: "portal.drafts" }, // Drafts section
  { globalAdminOnly: true }, // Campus switcher
  { navKey: "portal.activity" }, // Activity log
  { navKey: "portal.pages" }, // Block page editor
  { navKey: "portal.jobs" }, // Compare tray
  { navKey: "portal.jobs" }, // Bulk email
];

const HINT_INTERVAL_MS = 8000;
const HINT_FADE_MS = 350;

function StudioHintCarousel({
  hints,
  label,
  roles,
}: {
  hints: string[];
  label: string;
  roles: UserRolesForClient;
}) {
  const allowedHints = useMemo(
    () =>
      hints.filter((_, i) => {
        const access = HINT_ACCESS[i];
        if (!access) {
          return true;
        }
        if (access.globalAdminOnly) {
          return roles.isGlobalAdmin;
        }
        if (access.navKey) {
          return hasNavAccess(
            access.navKey,
            roles.roles,
            roles.hasDepartmentMembership
          );
        }
        return true;
      }),
    [hints, roles]
  );

  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  // Randomize the starting hint only on the client after hydration to avoid
  // server/client mismatch from Math.random() producing different values.
  useEffect(() => {
    if (allowedHints.length > 1) {
      setIdx(Math.floor(Math.random() * allowedHints.length));
    }
  }, [allowedHints.length]);

  useEffect(() => {
    if (allowedHints.length <= 1) {
      return;
    }
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((prev) => (prev + 1) % allowedHints.length);
        setVisible(true);
      }, HINT_FADE_MS);
    }, HINT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [allowedHints.length]);

  return (
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
        {label}
      </p>
      <p
        className="mt-1 text-[15px] leading-5"
        style={{
          color: STUDIO.ink,
          fontFamily: SERIF_STACK,
          opacity: visible ? 1 : 0,
          transition: `opacity ${HINT_FADE_MS}ms ease`,
        }}
      >
        {allowedHints[idx]}
      </p>
      {allowedHints.length > 1 && (
        <div className="mt-2.5 flex gap-1">
          {allowedHints.map((_, i) => (
            <span
              key={i}
              style={{
                background: i === idx ? STUDIO.ink3 : STUDIO.rule2,
                borderRadius: "9999px",
                display: "inline-block",
                height: 4,
                transition: "background 0.3s ease",
                width: i === idx ? 12 : 4,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarGroup({
  activePath,
  expanded,
  label,
  node,
  onToggle,
  t,
}: {
  activePath: string | null;
  expanded: boolean;
  label: string;
  node: NavGroupNode;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  const Icon = node.icon;
  return (
    <div>
      <button
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-white/60"
        onClick={onToggle}
        style={{ color: STUDIO.ink2 }}
        type="button"
      >
        <Icon size={15} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown
          size={13}
          style={{
            color: STUDIO.ink4,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          }}
        />
      </button>
      {expanded && (
        <div
          className="ml-4 space-y-0.5 border-l pl-2"
          style={{ borderColor: STUDIO.rule2 }}
        >
          {node.children.map((child) => (
            <SidebarLink
              active={activePath === child.path}
              href={child.path}
              icon={child.icon}
              key={child.path}
              label={t(child.labelKey)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarLink({
  active,
  badge,
  href,
  icon: Icon,
  label,
}: {
  active: boolean;
  badge?: number;
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
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className="rounded-full px-1.5 py-0.5 font-mono text-[10px] leading-none"
          style={
            active
              ? { background: STUDIO.paper, color: STUDIO.ink }
              : { background: STUDIO.claret, color: STUDIO.paper }
          }
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
