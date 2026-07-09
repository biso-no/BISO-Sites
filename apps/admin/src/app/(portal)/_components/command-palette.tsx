"use client";

import { useDebounce } from "@repo/ui/hooks/use-debounce";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
  ClipboardList,
  Clock,
  CreditCard,
  FileStack,
  FileText,
  Flag,
  Gauge,
  Gift,
  HardDrive,
  Inbox,
  Layers,
  LayoutDashboard,
  LineChart,
  LogOut,
  MapPin,
  Megaphone,
  Newspaper,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { setCampusFilter } from "@/lib/actions/campus";
import { signOut } from "@/lib/actions/user";
import type { UserRolesForClient } from "@/lib/authorization";
import { fuzzyScore } from "@/lib/fuzzy";
import type {
  PaletteEntityGroup,
  PaletteSearchHit,
} from "@/lib/palette-search-model";
import { type RecentEntry, readRecents, recordRecent } from "@/lib/recents";
import { hasNavAccess, type NavKey } from "@/lib/roles";
import { searchEverything } from "../_actions/palette-search";
import { OPEN_ASSISTANT_EVENT } from "./assistant/assistant-widget";
import { MONO_STACK, SERIF_STACK, STUDIO } from "./studio";

interface PaletteCommand {
  action?: () => Promise<void> | void;
  group: "navigate" | "create" | "account";
  href?: string;
  icon: LucideIcon;
  id: string;
  label: string;
  navKey?: NavKey;
}

type PaletteRow =
  | { kind: "ai"; prompt: string }
  | { kind: "command"; command: PaletteCommand }
  | { kind: "hit"; hit: PaletteSearchHit }
  | { kind: "recent"; recent: RecentEntry };

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
    id: "nav-inbox",
    group: "navigate",
    label: "Inbox",
    icon: Inbox,
    href: "/inbox",
    navKey: "portal.inbox",
  },
  {
    id: "nav-approvals",
    group: "navigate",
    label: "Approvals",
    icon: ClipboardList,
    href: "/inbox/approvals",
    navKey: "portal.inbox",
  },
  {
    id: "nav-submissions",
    group: "navigate",
    label: "Form Submissions",
    icon: Inbox,
    href: "/inbox/submissions",
    navKey: "portal.inbox",
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
    id: "nav-communications",
    group: "navigate",
    label: "Communications",
    icon: Megaphone,
    href: "/communications",
    navKey: "portal.communications",
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
    id: "nav-drafts",
    group: "navigate",
    label: "Drafts",
    icon: FileStack,
    href: "/drafts",
    navKey: "portal.drafts",
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
    id: "nav-analytics",
    group: "navigate",
    label: "Analytics",
    icon: LineChart,
    href: "/analytics",
    navKey: "portal.analytics",
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
    href: "/settings/operations",
    navKey: "portal.settings",
  },
  {
    id: "nav-feature-flags",
    group: "navigate",
    label: "Feature flags",
    icon: Flag,
    href: "/settings/feature-flags",
    navKey: "portal.settings",
  },
  {
    id: "nav-payment-settings",
    group: "navigate",
    label: "Payment settings",
    icon: CreditCard,
    href: "/settings/payments",
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
  // Account
  { id: "sign-out", group: "account", label: "Sign Out", icon: LogOut },
];

const GROUP_LABELS: Record<PaletteCommand["group"], string> = {
  account: "Account",
  create: "Create",
  navigate: "Navigate",
};

const RESULT_GROUP_ORDER: PaletteEntityGroup[] = [
  "jobs",
  "events",
  "news",
  "pages",
  "departments",
  "products",
  "orders",
];

const RESULT_GROUP_LABELS: Record<PaletteEntityGroup, string> = {
  departments: "Departments",
  events: "Events",
  jobs: "Jobs",
  news: "News",
  orders: "Orders",
  pages: "Pages",
  products: "Products",
};

const HIT_ICONS: Record<PaletteEntityGroup, LucideIcon> = {
  departments: Building2,
  events: Calendar,
  jobs: Briefcase,
  news: Newspaper,
  orders: CreditCard,
  pages: Layers,
  products: ShoppingCart,
};

const CAMPUSES = ["Oslo", "Bergen", "Trondheim", "Stavanger"] as const;

const OPEN_EVENT = "admin:open-palette";
const SEARCH_DEBOUNCE_MS = 200;
const MIN_SEARCH_LENGTH = 2;

interface PaletteSection {
  label: string;
  rows: PaletteRow[];
}

function rowKey(row: PaletteRow): string {
  switch (row.kind) {
    case "ai":
      return "ai-row";
    case "command":
      return row.command.id;
    case "hit":
      return `${row.hit.group}-${row.hit.id}`;
    case "recent":
      return `recent-${row.recent.href}`;
    default:
      return "unknown";
  }
}

export function CommandPalette({
  aiCopilotEnabled,
  roles,
}: {
  aiCopilotEnabled: boolean;
  roles: UserRolesForClient;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [results, setResults] = useState<PaletteSearchHit[]>([]);
  const [searchState, setSearchState] = useState<"error" | "idle" | "loading">(
    "idle"
  );
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
    setResults([]);
    setSearchState("idle");
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
      setRecents(readRecents());
      const id = setTimeout(() => inputRef.current?.focus(), 16);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    const el = document.querySelector(`[data-palette-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // Server-backed entity search, debounced; failures degrade to a quiet row.
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!open || q.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setSearchState("idle");
      return;
    }
    let cancelled = false;
    setSearchState("loading");
    searchEverything(q)
      .then((hits) => {
        if (!cancelled) {
          setResults(hits);
          setSearchState("idle");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setSearchState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open]);

  const campusCommands = useMemo<PaletteCommand[]>(() => {
    if (!roles.isGlobalAdmin) {
      return [];
    }
    return [...CAMPUSES, null].map((campus) => ({
      action: async () => {
        await setCampusFilter(campus);
        router.refresh();
      },
      group: "navigate" as const,
      icon: MapPin,
      id: `campus-${campus ?? "all"}`,
      label: campus
        ? `Switch campus: ${campus}`
        : "Switch campus: All campuses",
    }));
  }, [roles.isGlobalAdmin, router]);

  const visible = useMemo(() => {
    const allowed = ALL_COMMANDS.filter((cmd) => {
      if (cmd.navKey) {
        return hasNavAccess(
          cmd.navKey,
          roles.roles,
          roles.hasDepartmentMembership
        );
      }
      return true;
    });
    return [...allowed, ...campusCommands];
  }, [roles, campusCommands]);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return visible;
    }
    return visible
      .map((cmd) => ({ cmd, score: fuzzyScore(q, cmd.label) }))
      .filter(
        (entry): entry is { cmd: PaletteCommand; score: number } =>
          entry.score !== null
      )
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.cmd);
  }, [query, visible]);

  const sections = useMemo<PaletteSection[]>(() => {
    const list: PaletteSection[] = [];
    if (!query.trim() && recents.length > 0) {
      list.push({
        label: "Recent",
        rows: recents.map((recent) => ({ kind: "recent" as const, recent })),
      });
    }
    for (const group of ["navigate", "create", "account"] as const) {
      const commands = filtered.filter((cmd) => cmd.group === group);
      if (commands.length > 0) {
        list.push({
          label: GROUP_LABELS[group],
          rows: commands.map((command) => ({
            kind: "command" as const,
            command,
          })),
        });
      }
    }
    for (const group of RESULT_GROUP_ORDER) {
      const hits = results.filter((hit) => hit.group === group);
      if (hits.length > 0) {
        list.push({
          label: RESULT_GROUP_LABELS[group],
          rows: hits.map((hit) => ({ kind: "hit" as const, hit })),
        });
      }
    }
    if (aiCopilotEnabled) {
      list.push({
        label: "AI",
        rows: [{ kind: "ai" as const, prompt: query.trim() }],
      });
    }
    return list;
  }, [query, recents, filtered, results, aiCopilotEnabled]);

  const flatRows = useMemo(
    () => sections.flatMap((section) => section.rows),
    [sections]
  );

  async function handleSelect(row: PaletteRow) {
    close();
    if (row.kind === "ai") {
      window.dispatchEvent(
        new CustomEvent(OPEN_ASSISTANT_EVENT, {
          detail: row.prompt ? { prompt: row.prompt } : undefined,
        })
      );
      return;
    }
    if (row.kind === "recent") {
      recordRecent({ href: row.recent.href, label: row.recent.label });
      router.push(row.recent.href);
      return;
    }
    if (row.kind === "hit") {
      recordRecent({ href: row.hit.href, label: row.hit.title });
      router.push(row.hit.href);
      return;
    }
    const { command } = row;
    if (command.id === "sign-out") {
      await signOut();
      router.push("/auth/login");
      return;
    }
    if (command.action) {
      await command.action();
      return;
    }
    if (command.href) {
      recordRecent({ href: command.href, label: command.label });
      router.push(command.href);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((prev) => (prev + 1) % Math.max(1, flatRows.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(
        (prev) =>
          (prev - 1 + Math.max(1, flatRows.length)) %
          Math.max(1, flatRows.length)
      );
      return;
    }
    if (e.key === "Enter") {
      const selected = flatRows[cursor];
      if (selected) {
        handleSelect(selected);
      }
    }
  }

  if (!(mounted && open)) {
    return null;
  }

  let rowIndex = -1;

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
            placeholder="Search commands, content, people..."
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
          {flatRows.length === 0 && searchState === "idle" ? (
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
            <>
              {sections.map((section) => (
                <div key={section.label}>
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
                    {section.label}
                  </p>
                  {section.rows.map((row) => {
                    rowIndex += 1;
                    const flatIdx = rowIndex;
                    const isActive = flatIdx === cursor;
                    return (
                      <PaletteRowButton
                        flatIdx={flatIdx}
                        isActive={isActive}
                        key={rowKey(row)}
                        onHover={() => setCursor(flatIdx)}
                        onSelect={() => handleSelect(row)}
                        row={row}
                      />
                    );
                  })}
                </div>
              ))}
              {searchState !== "idle" && (
                <p
                  style={{
                    color: STUDIO.ink4,
                    fontFamily: MONO_STACK,
                    fontSize: "10px",
                    letterSpacing: "0.08em",
                    padding: "8px 10px",
                    textTransform: "uppercase",
                  }}
                >
                  {searchState === "loading"
                    ? "Searching…"
                    : "Search unavailable"}
                </p>
              )}
            </>
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

function PaletteRowButton({
  flatIdx,
  isActive,
  onHover,
  onSelect,
  row,
}: {
  flatIdx: number;
  isActive: boolean;
  onHover: () => void;
  onSelect: () => void;
  row: PaletteRow;
}) {
  let Icon: LucideIcon;
  let label: string;
  let subtitle: string | null = null;

  if (row.kind === "ai") {
    Icon = Sparkles;
    label = row.prompt
      ? `Ask BISO Assistant: “${row.prompt}”`
      : "Open BISO Assistant";
  } else if (row.kind === "recent") {
    Icon = Clock;
    label = row.recent.label;
  } else if (row.kind === "hit") {
    Icon = HIT_ICONS[row.hit.group];
    label = row.hit.title;
    subtitle = row.hit.subtitle;
  } else {
    Icon = row.command.icon;
    label = row.command.label;
  }

  return (
    <button
      data-palette-idx={flatIdx}
      onClick={onSelect}
      onMouseEnter={onHover}
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
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      {subtitle && (
        <span
          style={{
            color: isActive ? STUDIO.paper : STUDIO.ink4,
            fontSize: "11px",
          }}
        >
          {subtitle}
        </span>
      )}
    </button>
  );
}
