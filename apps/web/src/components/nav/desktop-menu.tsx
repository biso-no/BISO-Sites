"use client";

import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { PANEL_TRIGGERS, type PanelId } from "./nav-config";

/**
 * Shared by every item in the desktop row — the panel triggers, the standalone
 * links and their measurement twins — so a twin is exactly as wide as the item
 * it stands in for.
 */
const ROW_ITEM_CLASS =
  "flex shrink-0 items-center whitespace-nowrap rounded-biso-md px-2 py-2 text-ink transition-colors duration-200 hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

interface DesktopMenuProps {
  onPanelEnter: (id: PanelId) => void;
  onPanelFocus: (id: PanelId) => void;
  onPanelKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    id: PanelId
  ) => void;
  onPanelPointerDown: () => void;
  onPanelToggle: (id: PanelId) => void;
  openPanel: PanelId | null;
  registerTrigger: (id: PanelId, el: HTMLButtonElement | null) => void;
}

/**
 * The three mega-panel triggers. They are measured as one unit by
 * {@link useNavOverflow} and never collapse — losing them would leave the site
 * with no primary navigation at all.
 */
export function DesktopMenu({
  openPanel,
  onPanelEnter,
  onPanelToggle,
  onPanelFocus,
  onPanelPointerDown,
  onPanelKeyDown,
  registerTrigger,
}: DesktopMenuProps) {
  const t = useTranslations("common.navigation");

  return (
    <div className="flex items-center gap-0.5">
      {PANEL_TRIGGERS.map((trigger) => {
        const isOpen = openPanel === trigger.id;
        return (
          <button
            aria-controls={`nav-panel-${trigger.id}`}
            aria-expanded={isOpen}
            aria-haspopup="true"
            className={cn(ROW_ITEM_CLASS, "gap-1", isOpen && "text-ink-accent")}
            key={trigger.id}
            onClick={() => onPanelToggle(trigger.id)}
            onFocus={() => onPanelFocus(trigger.id)}
            onKeyDown={(event) => onPanelKeyDown(event, trigger.id)}
            onMouseEnter={() => onPanelEnter(trigger.id)}
            onPointerDown={onPanelPointerDown}
            ref={(el) => registerTrigger(trigger.id, el)}
            type="button"
          >
            {t(trigger.labelKey)}
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

interface NavRowLinkProps {
  href: string;
  icon?: LucideIcon;
  label: string;
  onActivate: () => void;
}

/**
 * A plain (non-panel) link in the desktop row — News, Shop, Business. Kept in
 * this file so it shares the trigger row's type scale and hover treatment.
 */
export function NavRowLink({
  href,
  icon: Icon,
  label,
  onActivate,
}: NavRowLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={cn(ROW_ITEM_CLASS, "gap-1.5", isActive && "text-ink-accent")}
      href={href}
      onFocus={onActivate}
      onMouseEnter={onActivate}
    >
      {Icon && <Icon aria-hidden className="size-4 opacity-90" />}
      {label}
    </Link>
  );
}

/**
 * The measurement twin of {@link NavRowLink}: same box, no link. The overflow
 * hook measures an item that is currently in the "…" menu from this copy, which
 * sits in an inert, invisible ghost row — so it must not be a second, hidden
 * link to the same page.
 */
export function NavRowLinkGhost({
  icon: Icon,
  label,
}: Pick<NavRowLinkProps, "icon" | "label">) {
  return (
    <span className={cn(ROW_ITEM_CLASS, "gap-1.5")}>
      {Icon && <Icon aria-hidden className="size-4 opacity-90" />}
      {label}
    </span>
  );
}
