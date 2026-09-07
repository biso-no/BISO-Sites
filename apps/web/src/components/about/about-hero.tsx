"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/components/ui/breadcrumb";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Fragment, type ReactNode } from "react";

interface BreadcrumbEntry {
  href?: string;
  label: string;
}

interface AboutHeroProps {
  breadcrumbs: BreadcrumbEntry[];
  compact?: boolean;
  icon?: ReactNode;
  subtitle?: string;
  title: string;
}

export function AboutHero({
  title,
  subtitle,
  breadcrumbs,
  icon,
  compact = false,
}: AboutHeroProps) {
  const t = useTranslations("common.labels");
  const scrollLabel = t("scrollToContent");
  const scrollToContent = () => {
    document
      .getElementById("about-content")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className={`relative overflow-hidden ${compact ? "h-[35vh] min-h-[280px]" : "h-[50vh] min-h-[400px]"}`}
    >
      {/* Background */}
      <ImageWithFallback
        // Decorative: the heading beside it carries the meaning.
        alt=""
        className="h-full w-full object-cover"
        height={40}
        priority
        sizes="100vw"
        src="/images/hero-bg.png"
        width={140}
      />
      <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />
      <div className="absolute inset-0 bg-linear-to-t from-brand-overlay-from/50 via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            {/* Breadcrumbs */}
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 flex justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <Breadcrumb>
                <BreadcrumbList className="flex flex-wrap justify-center gap-1.5 text-sm text-white/70">
                  {breadcrumbs.map((bc, idx) => (
                    <Fragment key={`${bc.label}-${idx}`}>
                      <BreadcrumbItem>
                        {bc.href ? (
                          <BreadcrumbLink
                            asChild
                            className="text-white/70 transition-colors hover:text-white"
                          >
                            <Link href={bc.href}>{bc.label}</Link>
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage className="text-white">
                            {bc.label}
                          </BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                      {idx < breadcrumbs.length - 1 && (
                        <BreadcrumbSeparator className="text-white/50" />
                      )}
                    </Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </motion.div>

            {/* Icon */}
            {icon && (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="mb-4 flex items-center justify-center"
                initial={{ opacity: 0, scale: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-lg">
                  {icon}
                </div>
              </motion.div>
            )}

            {/* Title */}
            <motion.h1
              animate={{ opacity: 1, y: 0 }}
              className={`mb-4 font-bold text-white ${compact ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl lg:text-6xl"}`}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              {title}
            </motion.h1>

            {/* Subtitle */}
            {subtitle && (
              <motion.p
                animate={{ opacity: 1 }}
                className="mx-auto max-w-2xl text-lg text-white/80"
                initial={{ opacity: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
              >
                {subtitle}
              </motion.p>
            )}
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator. RD-031: it bounced forever, and kept bouncing with
          `prefers-reduced-motion: reduce` set — `motion`'s JS animations are
          not stopped by the CSS media query. It is a scroll affordance, so it
          stays put and stays clickable. */}
      {!compact && (
        <motion.button
          aria-label={scrollLabel}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer rounded-biso-md focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-solid focus-visible:outline-offset-2"
          onClick={scrollToContent}
          type="button"
        >
          {/* RD-031: the button held only an icon, so axe reported
              `button-name` (critical) — a screen reader announced an unnamed
              button. */}
          <ChevronDown aria-hidden="true" className="h-8 w-8 text-white/70" />
        </motion.button>
      )}
    </div>
  );
}
