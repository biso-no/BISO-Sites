"use client";

import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  FileStack,
  FileText,
  Flag,
  Gauge,
  Gift,
  HardDrive,
  Layers,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut } from "@/lib/actions/user";
import type { UserRolesForClient } from "@/lib/authorization";
import { hasNavAccess, type NavKey } from "@/lib/roles";
import { MONO_STACK, SERIF_STACK, STUDIO } from "./studio";

interface PaletteCommand {
  action?: () => void;
  group: "navigate" | "create" | "ai" | "account";
  href?: string;
  icon: React.ComponentType<{ size?: number }>;
  id: string;
  label: string;
  navKey?: NavKey;
}

const ALL_COMMANDS: PaletteCommand[] = [
  // Navigate
  {
    id: "nav-overview",
    group: "navigate",
    label: "Overview",
    icon: LayoutDashboard,
    href: "/",
    navKey: "portal.dashboard",
  },
  {
    id: "nav-jobs",
    group: "navigate",
    label: "Jobs",
    icon: Briefcase,
    href: "/jobs",
    navKey: "portal.jobs",
  },
  {
    id: "nav-events",
    group: "navigate",
    label: "Events",
    icon: Calendar,
    href: "/events",
    navKey: "portal.events",
  },
  {
    id: "nav-news",
    group: "navigate",
    label: "News",
    icon: Newspaper,
    href: "/news",
    navKey: "portal.news",
  },
  {
    id: "nav-benefits",
    group: "navigate",
    label: "Benefits",
    icon: Gift,
    href: "/benefits",
    navKey: "portal.benefits",
  },
  {
    id: "nav-shop",
    group: "navigate",
    label: "Shop",
    icon: ShoppingCart,
    href: "/shop",
    navKey: "portal.shop",
  },
  {
    id: "nav-pages",
    group: "navigate",
    label: "Pages",
    icon: Layers,
    href: "/pages",
    navKey: "portal.pages",
  },
  {
    id: "nav-departments",
    group: "navigate",
    label: "Departments",
    icon: Building2,
    href: "/departments",
    navKey: "portal.departments",
  },
  {
    id: "nav-documents",
    group: "navigate",
    label: "Documents",
    icon: FileText,
    href: "/documents",
    navKey: "portal.documents",
  },
  {
    id: "nav-activity",
    group: "navigate",
    label: "Activity",
    icon: Activity,
    href: "/activity",
    navKey: "portal.activity",
  },
  {
    id: "nav-drafts",
    group: "navigate",
    label: "Drafts",
    icon: FileStack,
    href: "/drafts",
    navKey: "portal.drafts",
  },
  {
    id: "nav-it",
    group: "navigate",
    label: "IT Console",
    icon: HardDrive,
    href: "/it",
    navKey: "portal.it",
  },
  {
    id: "nav-operations",
    group: "navigate",
    label: "Operations health",
    icon: Gauge,
    href: "/operations",
    navKey: "portal.settings",
  },
  {
    id: "nav-feature-flags",
    group: "navigate",
    label: "Feature flags",
    icon: Flag,
    href: "/feature-flags",
    navKey: "portal.settings",
  },
  {
    id: "nav-settings",
    group: "navigate",
    label: "Settings",
    icon: Settings,
    href: "/settings",
    navKey: "portal.settings",
  },
  // Create
  {
    id: "new-job",
    group: "create",
    label: "New Job Posting",
    icon: Plus,
    href: "/jobs/new",
    navKey: "portal.jobs",
  },
  {
    id: "new-event",
    group: "create",
    label: "New Event",
    icon: Plus,
    href: "/events/new",
    navKey: "portal.events",
  },
  {
    id: "new-news",
    group: "create",
    label: "New News Article",
    icon: Plus,
    href: "/news/new",
    navKey: "portal.news",
  },
  // AI Assistant
  {
    id: "open-assistant",
    group: "ai",
    label: "Open BISO Assistant",
    icon: Sparkles,
    action: () => window.dispatchEvent(new Event("admin:open-assistant")),
  },
  // Account
  { id: "sign-out", group: "account", label: "Sign Out", icon: LogOut },
];

const GROUP_LABELS: Record<PaletteCommand["group"], string> = {
  account: "Account",
  ai: "AI",
  create: "Create",
  navigate: "Navigate",
};

const OPEN_EVENT = "admin:open-palette";

export function CommandPalette({ roles }: { roles: UserRolesForClient }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener(OPEN_EVENT, handleOpen);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 16);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    const el = document.querySelector(`[data-palette-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const visible = ALL_COMMANDS.filter((cmd) => {
    if (cmd.navKey) {
      return hasNavAccess(
        cmd.navKey,
        roles.roles,
        roles.hasDepartmentMembership
      );
    }
    return true;
  });

  const filtered = query.trim()
    ? visible.filter((cmd) =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
      )
    : visible;

  const groups = (["navigate", "create", "ai", "account"] as const)
    .map((group) => ({
      group,
      items: filtered.filter((cmd) => cmd.group === group),
      label: GROUP_LABELS[group],
    }))
    .filter((g) => g.items.length > 0);

  const flatItems = groups.flatMap((g) => g.items);

  async function handleSelect(cmd: PaletteCommand) {
    close();
    if (cmd.id === "sign-out") {
      await signOut();
      router.push("/auth/login");
      return;
    }
    if (cmd.action) {
      cmd.action();
      return;
    }
    if (cmd.href) {
      router.push(cmd.href);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((prev) => (prev + 1) % Math.max(1, flatItems.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(
        (prev) =>
          (prev - 1 + Math.max(1, flatItems.length)) %
          Math.max(1, flatItems.length)
      );
      return;
    }
    if (e.key === "Enter") {
      const selected = flatItems[cursor];
      if (selected) {
        handleSelect(selected);
      }
    }
  }

  if (!(mounted && open)) {
    return null;
  }

  return createPortal(
    <>
      <button
        aria-label="Close command palette"
        onClick={close}
        style={{
          background: "rgba(26,24,20,0.35)",
          border: 0,
          bottom: 0,
          cursor: "default",
          left: 0,
          position: "fixed",
          right: 0,
          top: 0,
          zIndex: 9999,
        }}
        type="button"
      />
      <div
        aria-label="Command palette"
        aria-modal="true"
        role="dialog"
        style={{
          background: "white",
          border: `0.5px solid ${STUDIO.rule2}`,
          borderRadius: "16px",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          left: "50%",
          maxHeight: "460px",
          overflow: "hidden",
          position: "fixed",
          top: "14vh",
          transform: "translateX(-50%)",
          width: "540px",
          zIndex: 10_000,
        }}
      >
        <div
          style={{
            alignItems: "center",
            borderBottom: `0.5px solid ${STUDIO.rule}`,
            display: "flex",
            gap: "10px",
            padding: "14px 16px",
          }}
        >
          <Search size={16} style={{ color: STUDIO.ink3, flexShrink: 0 }} />
          <input
            aria-label="Search commands"
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            ref={inputRef}
            style={{
              background: "transparent",
              border: 0,
              color: STUDIO.ink,
              flex: 1,
              fontSize: "14px",
              outline: 0,
            }}
            type="text"
            value={query}
          />
          <button
            aria-label="Close command palette"
            onClick={close}
            style={{
              alignItems: "center",
              background: STUDIO.rule,
              border: 0,
              borderRadius: "6px",
              color: STUDIO.ink3,
              cursor: "pointer",
              display: "flex",
              flexShrink: 0,
              height: "22px",
              justifyContent: "center",
              width: "22px",
            }}
            type="button"
          >
            <X size={12} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "6px" }}>
          {flatItems.length === 0 ? (
            <p
              style={{
                color: STUDIO.ink3,
                fontFamily: SERIF_STACK,
                fontSize: "15px",
                fontStyle: "italic",
                padding: "28px 16px",
                textAlign: "center",
              }}
            >
              No commands match &ldquo;{query}&rdquo;
            </p>
          ) : (
            groups.map(({ group, items, label }) => (
              <div key={group}>
                <p
                  style={{
                    color: STUDIO.ink4,
                    fontFamily: MONO_STACK,
                    fontSize: "10px",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    padding: "8px 10px 4px",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </p>
                {items.map((cmd) => {
                  const flatIdx = flatItems.indexOf(cmd);
                  const isActive = flatIdx === cursor;
                  const Icon = cmd.icon;
                  return (
                    <button
                      data-palette-idx={flatIdx}
                      key={cmd.id}
                      onClick={() => handleSelect(cmd)}
                      onMouseEnter={() => setCursor(flatIdx)}
                      style={{
                        alignItems: "center",
                        background: isActive ? STUDIO.ink : "transparent",
                        border: 0,
                        borderRadius: "10px",
                        color: isActive ? STUDIO.paper : STUDIO.ink2,
                        cursor: "pointer",
                        display: "flex",
                        fontSize: "13.5px",
                        gap: "10px",
                        padding: "9px 10px",
                        textAlign: "left",
                        transition: "background 80ms",
                        width: "100%",
                      }}
                      type="button"
                    >
                      <Icon size={15} />
                      <span style={{ flex: 1, minWidth: 0 }}>{cmd.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div
          style={{
            alignItems: "center",
            borderTop: `0.5px solid ${STUDIO.rule}`,
            color: STUDIO.ink4,
            display: "flex",
            fontFamily: MONO_STACK,
            fontSize: "10px",
            gap: "16px",
            padding: "8px 16px",
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </>,
    document.body
  );
}
