"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { cn } from "../../lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  breadcrumbs?: BreadcrumbItem[];
  variant?: "default" | "centered" | "minimal";
  showDivider?: boolean;
};

/**
 * PageHeader block for static content pages.
 * Clean, simple header with optional breadcrumbs and metadata.
 */
export function PageHeader({
  title,
  subtitle,
  lastUpdated,
  breadcrumbs = [],
  variant = "default",
  showDivider = true,
}: PageHeaderProps) {
  const variantClasses = {
    default: "text-left",
    centered: "text-center",
    minimal: "text-left",
  };

  return (
    <header className={cn("w-full", variantClasses[variant])}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className={cn(
            "mb-6 flex items-center gap-2 text-muted-foreground text-sm",
            variant === "centered" && "justify-center"
          )}
        >
          <Link
            className="flex items-center gap-1 transition-colors hover:text-foreground"
            href="/"
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">Home</span>
          </Link>
          {breadcrumbs.map((crumb) => (
            <span className="flex items-center gap-2" key={crumb.label}>
              <ChevronRight className="h-4 w-4" />
              {crumb.href ? (
                <Link
                  className="transition-colors hover:text-foreground"
                  href={crumb.href}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title */}
      <h1
        className={cn(
          "font-bold text-4xl text-foreground tracking-tight md:text-5xl",
          variant === "minimal" && "text-3xl md:text-4xl"
        )}
      >
        {title}
      </h1>

      {/* Subtitle */}
      {subtitle && (
        <p
          className={cn(
            "mt-4 max-w-3xl text-lg text-muted-foreground md:text-xl",
            variant === "centered" && "mx-auto"
          )}
        >
          {subtitle}
        </p>
      )}

      {/* Last Updated */}
      {lastUpdated && (
        <p className="mt-4 text-muted-foreground text-sm">
          Last updated: {lastUpdated}
        </p>
      )}

      {/* Divider */}
      {showDivider && <div className="mt-8 border-border border-b" />}
    </header>
  );
}
