"use client";

import { cn } from "@repo/ui/lib/utils";
import { AREAS, type AreaId, activeArea } from "lib/areas";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** The two areas as a two-segment control; the one you are in is filled navy. */
export function AreaSwitch() {
  return <AreaSegments active={activeArea(usePathname() ?? "")} />;
}

export function AreaSegments({ active }: { active: AreaId | null }) {
  return (
    <nav
      aria-label="Documentation areas"
      className="grid grid-cols-2 overflow-hidden rounded-biso-sm border border-edge text-[12.5px]"
    >
      {AREAS.map((area) => {
        const isActive = area.id === active;
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "py-1.5 text-center transition-colors",
              isActive
                ? "bg-deep font-bold text-paper dark:bg-sky dark:text-deep"
                : "bg-surface text-ink-muted hover:text-ink"
            )}
            href={area.href}
            key={area.id}
          >
            {area.title}
          </Link>
        );
      })}
    </nav>
  );
}
