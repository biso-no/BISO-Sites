"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { KeyboardEvent } from "react";
import { PANEL_TRIGGERS, type PanelId, STANDALONE_LINKS } from "./nav-config";

interface DesktopMenuProps {
  onPanelEnter: (id: PanelId) => void;
  onPanelFocus: (id: PanelId) => void;
  onPanelKeyDown: (
    event: KeyboardEvent<HTMLButtonElement>,
    id: PanelId
  ) => void;
  onPanelPointerDown: () => void;
  onPanelToggle: (id: PanelId) => void;
  onStandaloneEnter: () => void;
  openPanel: PanelId | null;
  registerTrigger: (id: PanelId, el: HTMLButtonElement | null) => void;
}

export function DesktopMenu({
  openPanel,
  onPanelEnter,
  onPanelToggle,
  onPanelFocus,
  onPanelPointerDown,
  onPanelKeyDown,
  onStandaloneEnter,
  registerTrigger,
}: DesktopMenuProps) {
  const t = useTranslations("common.navigation");
  const pathname = usePathname();

  return (
    <div className="flex min-w-0 items-center gap-0.5 text-[0.92rem]">
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

      {STANDALONE_LINKS.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-white transition-colors duration-200 hover:text-brand ${
              isActive ? "text-brand" : ""
            }`}
            href={link.href}
            key={link.id}
            onFocus={onStandaloneEnter}
            onMouseEnter={onStandaloneEnter}
          >
            {link.icon && (
              <link.icon aria-hidden className="h-4 w-4 opacity-90" />
            )}
            {t(link.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
