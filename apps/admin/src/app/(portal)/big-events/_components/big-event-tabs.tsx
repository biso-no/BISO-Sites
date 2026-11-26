"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { STUDIO } from "../../_components/studio";

interface BigEventTabsProps {
  bigEventId: string;
  labels: {
    groups: string;
    messages: string;
    participants: string;
    settings: string;
  };
  /** Settings is shown only to people who may change them. */
  showSettings: boolean;
}

const TABS = [
  { key: "participants" as const, segment: "participants", settings: false },
  { key: "groups" as const, segment: "groups", settings: false },
  { key: "messages" as const, segment: "messages", settings: false },
  { key: "settings" as const, segment: "settings", settings: true },
];

export function BigEventTabs({
  bigEventId,
  labels,
  showSettings,
}: BigEventTabsProps) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => showSettings || !tab.settings);

  return (
    <nav
      className="mb-6 flex items-center gap-1 border-b pb-px"
      style={{ borderColor: STUDIO.rule }}
    >
      {visibleTabs.map((tab) => {
        const href = `/big-events/${bigEventId}/${tab.segment}`;
        const isActive = pathname.startsWith(href);
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className="-mb-px rounded-t-lg border-b-2 px-4 py-2.5 font-medium text-sm transition-colors"
            href={href}
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
