"use client";

import { ChevronDown, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { PANEL_TRIGGERS, type PanelId } from "./nav-config";

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
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 text-white transition-colors duration-200 hover:text-brand ${
              isOpen ? "text-brand" : ""
            }`}
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
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
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
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-white transition-colors duration-200 hover:text-brand ${
        isActive ? "text-brand" : ""
      }`}
      href={href}
      onFocus={onActivate}
      onMouseEnter={onActivate}
    >
      {Icon && <Icon aria-hidden className="h-4 w-4 opacity-90" />}
      {label}
    </Link>
  );
}
