"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDIO } from "../../../_components/studio";

interface ExpensesSettingsTabsProps {
  labels: {
    ai: string;
    approvers: string;
    types: string;
  };
  /**
   * Types and AI are global-admin pages, so campus admins, who only manage
   * approvers, do not see them.
   */
  showGlobalTabs: boolean;
}

const TABS = [
  { globalOnly: true, href: "/expenses/settings", key: "types" as const },
  {
    globalOnly: false,
    href: "/expenses/settings/approvers",
    key: "approvers" as const,
  },
  { globalOnly: true, href: "/expenses/settings/ai", key: "ai" as const },
];

export function ExpensesSettingsTabs({
  labels,
  showGlobalTabs,
}: ExpensesSettingsTabsProps) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => showGlobalTabs || !tab.globalOnly);

  if (visibleTabs.length < 2) {
    return null;
  }

  return (
    <nav
      className="mt-6 mb-6 flex items-center gap-1 border-b pb-px"
      style={{ borderColor: STUDIO.rule }}
    >
      {visibleTabs.map((tab) => {
        const isActive =
          tab.href === "/expenses/settings"
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
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
