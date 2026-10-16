"use client";

import { cn } from "@repo/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { NavColumnConfig } from "./nav-config";

/**
 * A column heading inside a panel or a mobile-drawer group. The micro-label
 * role, muted, so the links under it carry the weight.
 */
export const PANEL_HEADING_CLASS = "type-label mb-2 px-2 text-ink-muted";

interface MegaPanelProps {
  ariaLabel: string;
  children: ReactNode;
  id: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Full-width panel shell rendered below the nav bar.
 *
 * It sits inside the header's `data-surface="deep"`, so `bg-surface` is the
 * same navy as the solid header and every alias inside it is the on-navy one.
 * Opaque, with an elevation shadow: the design system has no translucent
 * blurred surfaces. The short fade is motion answering the user's own action.
 */
export function MegaPanel({
  id,
  ariaLabel,
  onMouseEnter,
  onMouseLeave,
  children,
}: MegaPanelProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      aria-label={ariaLabel}
      className="absolute inset-x-0 top-full border-edge border-t bg-surface shadow-elev-2"
      id={id}
      initial={{ opacity: 0, y: -4 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="region"
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <div className="mx-auto w-full max-w-biso-wide px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </motion.div>
  );
}

interface PanelLinkProps {
  href: string;
  icon?: LucideIcon;
  label: string;
  onNavigate: () => void;
}

/**
 * A single link inside a panel column or a drawer group; closes the menu on
 * navigation, and marks the page you are on.
 */
export function PanelLink({
  href,
  label,
  icon: Icon,
  onNavigate,
}: PanelLinkProps) {
  const pathname = usePathname();
  const isCurrent = pathname === href;

  return (
    <Link
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "type-body-sm flex items-center gap-2 rounded-biso-sm px-2 py-1.5 text-ink transition-colors hover:bg-surface-raised hover:text-ink-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        isCurrent && "text-ink-accent"
      )}
      href={href}
      onClick={onNavigate}
    >
      {Icon && <Icon aria-hidden className="size-4 shrink-0 text-ink-muted" />}
      {label}
    </Link>
  );
}

interface PanelColumnProps {
  column: NavColumnConfig;
  onNavigate: () => void;
}

/** Renders a config-driven column: a heading plus a list of links. */
export function PanelColumn({ column, onNavigate }: PanelColumnProps) {
  const t = useTranslations("common.navigation");

  return (
    <div>
      <h3 className={PANEL_HEADING_CLASS}>{t(column.headingKey)}</h3>
      <ul className="space-y-0.5">
        {column.links.map((link) => (
          <li key={link.id}>
            <PanelLink
              href={link.href}
              icon={link.icon}
              label={t(link.labelKey)}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
