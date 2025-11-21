import { Badge } from "@repo/ui/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { Fragment } from "react";

type BreadcrumbEntry = { label: string; href?: string };

interface PublicPageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs: BreadcrumbEntry[];
}

export function PublicPageHeader({
  title,
  subtitle,
  breadcrumbs,
}: PublicPageHeaderProps) {
  const eyebrowLabel = breadcrumbs[0]?.label ?? "BISO";
  const currentPage = breadcrumbs[breadcrumbs.length - 1]?.label ?? title;
  const parentLabel =
    breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2]?.label : null;

  const renderedBreadcrumbs = breadcrumbs.length ? (
    breadcrumbs.map((bc, idx) => (
      <Fragment key={`${bc.label}-${idx}`}>
        <BreadcrumbItem>
          {bc.href ? (
            <BreadcrumbLink
              asChild
              className="text-primary-60 hover:text-primary-40"
            >
              <Link href={bc.href}>{bc.label}</Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="text-primary-40">
              {bc.label}
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {idx < breadcrumbs.length - 1 && (
          <BreadcrumbSeparator className="text-primary-60/80" />
        )}
      </Fragment>
    ))
  ) : (
    <BreadcrumbItem>
      <BreadcrumbPage>{title}</BreadcrumbPage>
    </BreadcrumbItem>
  );

  return (
    <section className="surface-spotlight glass-panel accent-ring relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-12">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary-100/90 via-blue-strong/70 to-primary-80/80 opacity-[0.16]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-primary-soft opacity-60" />
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-primary-40">
          <Badge
            variant="outline"
            className="border-primary/15 bg-white/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-wide text-primary-80 shadow-sm"
          >
            {eyebrowLabel}
          </Badge>
          <span className="inline-flex h-6 items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 font-semibold text-primary-70">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary-100" />
            {parentLabel ?? "Aktiv side"}
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-primary-100 sm:text-4xl lg:text-[2.75rem]">
                <span className="gradient-text">{title}</span>
              </h1>
              {subtitle && (
                <p className="max-w-2xl text-sm text-primary-20 sm:text-base sm:leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-primary/15 bg-white/80 px-4 py-3 text-sm font-medium text-primary-70 shadow-sm backdrop-blur">
              <span className="block text-[0.7rem] uppercase tracking-[0.16em] text-primary-60">
                Nåværende
              </span>
              <span className="text-base font-semibold text-primary-90">
                {currentPage}
              </span>
            </div>
          </div>

          <div className="gradient-divider" />

          <Breadcrumb>
            <BreadcrumbList
              className={cn(
                "flex flex-wrap gap-1.5 text-[0.85rem] font-medium text-primary-60",
                "sm:gap-2.5"
              )}
            >
              {renderedBreadcrumbs}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>
    </section>
  );
}
