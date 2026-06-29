"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { NavColumnConfig } from "./nav-config";

interface MegaPanelProps {
  ariaLabel: string;
  children: ReactNode;
  id: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/** Generic full-width animated panel shell rendered below the nav bar. */
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
      className="absolute inset-x-0 top-full border-brand-border border-t bg-nav-background shadow-brand/10 shadow-lg backdrop-blur-lg"
      exit={{ opacity: 0, y: -4 }}
      id={id}
      initial={{ opacity: 0, y: -4 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="region"
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <div className="mx-auto w-full max-w-[min(1400px,100%)] px-4 py-8 sm:px-6 lg:px-8">
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

/** A single link inside a panel column; closes the menu on navigation. */
export function PanelLink({
  href,
  label,
  icon: Icon,
  onNavigate,
}: PanelLinkProps) {
  return (
    <Link
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-white/80 transition-colors hover:bg-brand-muted hover:text-brand"
      href={href}
      onClick={onNavigate}
    >
      {Icon && <Icon aria-hidden className="h-4 w-4 shrink-0 opacity-80" />}
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
      <h3 className="mb-2 font-semibold text-white/50 text-xs uppercase tracking-wider">
        {t(column.headingKey)}
      </h3>
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
