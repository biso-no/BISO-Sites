"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDIO } from "../../../_components/studio";

interface ItUsersTabsProps {
  labels: {
    audit: string;
    dataHealth: string;
    users: string;
  };
}

const TABS = [
  { href: "/it/users", key: "users" as const },
  { href: "/it/users/audit", key: "audit" as const },
  { href: "/it/data-health", key: "dataHealth" as const },
];

export function ItUsersTabs({ labels }: ItUsersTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      className="mb-6 flex items-center gap-1 border-b pb-px"
      style={{ borderColor: STUDIO.rule }}
    >
      {TABS.map((tab) => {
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
