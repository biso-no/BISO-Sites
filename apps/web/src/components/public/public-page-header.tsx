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

type PublicPageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs: BreadcrumbEntry[];
};

export function PublicPageHeader({
  title,
  subtitle,
  breadcrumbs,
}: PublicPageHeaderProps) {
  const eyebrowLabel = breadcrumbs[0]?.label ?? "BISO";
  const currentPage = breadcrumbs.at(-1)?.label ?? title;
  const parentLabel = breadcrumbs.length > 1 ? breadcrumbs.at(-2)?.label : null;

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
    <section className="surface-spotlight glass-panel relative overflow-hidden px-6 py-7 accent-ring sm:px-8 sm:py-8 lg:px-10 lg:py-12">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary-100/90 via-blue-strong/70 to-primary-80/80 opacity-[0.16]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-primary-soft opacity-60" />
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3 text-primary-40 text-xs uppercase tracking-[0.18em]">
          <Badge
            className="border-primary/15 bg-white/80 px-3 py-1 font-semibold text-[0.68rem] text-primary-80 uppercase tracking-wide shadow-sm"
            variant="outline"
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
              <h1 className="font-semibold text-3xl text-primary-100 tracking-tight sm:text-4xl lg:text-[2.75rem]">
                <span className="gradient-text">{title}</span>
              </h1>
              {subtitle && (
                <p className="max-w-2xl text-primary-20 text-sm sm:text-base sm:leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-primary/15 bg-white/80 px-4 py-3 font-medium text-primary-70 text-sm shadow-sm backdrop-blur">
              <span className="block text-[0.7rem] text-primary-60 uppercase tracking-[0.16em]">
                Nåværende
              </span>
              <span className="font-semibold text-base text-primary-90">
                {currentPage}
              </span>
            </div>
          </div>

          <div className="gradient-divider" />

          <Breadcrumb>
            <BreadcrumbList
              className={cn(
                "flex flex-wrap gap-1.5 font-medium text-[0.85rem] text-primary-60",
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
