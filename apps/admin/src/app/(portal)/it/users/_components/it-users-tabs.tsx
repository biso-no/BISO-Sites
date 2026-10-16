"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDIO } from "../../../_components/studio";

interface ItUsersTabsProps {
  labels: {
    audit: string;
    dataHealth: string;
    expenseApprovals: string;
    users: string;
  };
  /**
   * Audit, data health and expense approvals read across every campus, so they
   * are hidden from campus admins — who otherwise only see their own campus.
   */
  showTenantTools: boolean;
}

const TABS = [
  { href: "/it/users", key: "users" as const, tenantWide: false },
  { href: "/it/users/audit", key: "audit" as const, tenantWide: true },
  { href: "/it/data-health", key: "dataHealth" as const, tenantWide: true },
  {
    href: "/it/expense-approvals",
    key: "expenseApprovals" as const,
    tenantWide: true,
  },
];

export function ItUsersTabs({ labels, showTenantTools }: ItUsersTabsProps) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => showTenantTools || !tab.tenantWide);

  if (visibleTabs.length < 2) {
    return null;
  }

  return (
    <nav
      className="mb-6 flex items-center gap-1 border-b pb-px"
      style={{ borderColor: STUDIO.rule }}
    >
      {visibleTabs.map((tab) => {
        const isActive =
          tab.href === "/it/users"
            ? pathname === "/it/users"
            : pathname.startsWith(tab.href);

        return (
          <Link
            className="-mb-px rounded-t-lg border-b-2 px-4 py-2.5 font-medium text-sm transition-colors"
            href={tab.href}
            key={tab.key}
            style={{
              borderColor: isActive ? STUDIO.claret : "transparent",
              color: isActive ? STUDIO.ink : STUDIO.ink3,
            }}
          >
            {labels[tab.key]}
          </Link>
        );
      })}
    </nav>
  );
}
