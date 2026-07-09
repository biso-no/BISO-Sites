import {
  Activity,
  Briefcase,
  Building2,
  Calendar,
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
  type LucideIcon,
  Megaphone,
  Newspaper,
  Settings,
  ShoppingCart,
} from "lucide-react";
import { hasNavAccess, type NavKey } from "@/lib/roles";

export interface NavLeaf {
  icon: LucideIcon;
  kind: "leaf";
  labelKey: string;
  navKey: NavKey;
  path: string;
}

export interface NavGroup {
  children: NavLeaf[];
  icon: LucideIcon;
  id: string;
  kind: "group";
  labelKey: string;
}

export type NavNode = NavGroup | NavLeaf;

export interface NavRoleInput {
  hasDepartmentMembership: boolean;
  roles: string[];
}

const leaf = (
  labelKey: string,
  navKey: NavKey,
  path: string,
  icon: LucideIcon
): NavLeaf => ({ icon, kind: "leaf", labelKey, navKey, path });

export const NAV_TREE: NavNode[] = [
  leaf("overview", "portal.dashboard", "/", LayoutDashboard),
  leaf("inbox", "portal.inbox", "/inbox", Inbox),
  {
    children: [
      leaf("pages", "portal.pages", "/pages", Layers),
      leaf("news", "portal.news", "/news", Newspaper),
      leaf("events", "portal.events", "/events", Calendar),
      leaf("jobs", "portal.jobs", "/jobs", Briefcase),
      leaf(
        "communications",
        "portal.communications",
        "/communications",
        Megaphone
      ),
      leaf("benefits", "portal.benefits", "/benefits", Gift),
      leaf("drafts", "portal.drafts", "/drafts", FileStack),
    ],
    icon: Layers,
    id: "content",
    kind: "group",
    labelKey: "content",
  },
  leaf("shop", "portal.shop", "/shop", ShoppingCart),
  {
    children: [
      leaf("departments", "portal.departments", "/departments", Building2),
      leaf("documents", "portal.documents", "/documents", FileText),
    ],
    icon: Building2,
    id: "organization",
    kind: "group",
    labelKey: "organization",
  },
  leaf("analytics", "portal.analytics", "/analytics", LineChart),
  {
    children: [
      leaf("it", "portal.it", "/it", HardDrive),
      leaf("activity", "portal.activity", "/activity", Activity),
      leaf("operations", "portal.settings", "/settings/operations", Gauge),
      leaf("featureFlags", "portal.settings", "/settings/feature-flags", Flag),
      leaf("payments", "portal.settings", "/settings/payments", CreditCard),
      leaf("settings", "portal.settings", "/settings", Settings),
    ],
    icon: Gauge,
    id: "system",
    kind: "group",
    labelKey: "system",
  },
];

/**
 * Role-filter the tree: leaves gate on hasNavAccess; a group with no visible
 * children is hidden; a group with exactly one visible child flattens to it.
 */
export function filterNavTree(
  input: NavRoleInput,
  tree: NavNode[] = NAV_TREE
): NavNode[] {
  const visible: NavNode[] = [];
  for (const node of tree) {
    if (node.kind === "leaf") {
      if (
        hasNavAccess(node.navKey, input.roles, input.hasDepartmentMembership)
      ) {
        visible.push(node);
      }
      continue;
    }
    const children = node.children.filter((child) =>
      hasNavAccess(child.navKey, input.roles, input.hasDepartmentMembership)
    );
    if (children.length === 0) {
      continue;
    }
    const [onlyChild] = children;
    if (children.length === 1 && onlyChild) {
      visible.push(onlyChild);
      continue;
    }
    visible.push({ ...node, children });
  }
  return visible;
}

export function flattenNavTree(tree: NavNode[] = NAV_TREE): NavLeaf[] {
  return tree.flatMap((node) =>
    node.kind === "leaf" ? [node] : node.children
  );
}

/** Longest-prefix match of pathname against nav leaf paths ("/" is exact). */
export function findActivePath(
  pathname: string,
  tree: NavNode[] = NAV_TREE
): string | null {
  let best: string | null = null;
  for (const item of flattenNavTree(tree)) {
    const matches =
      item.path === "/"
        ? pathname === "/"
        : pathname === item.path || pathname.startsWith(`${item.path}/`);
    if (matches && (best === null || item.path.length > best.length)) {
      best = item.path;
    }
  }
  return best;
}
