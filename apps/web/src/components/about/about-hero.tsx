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
import { Fragment, type ReactNode } from "react";

type BreadcrumbEntry = { label: string; href?: string };

type AboutHeroProps = {
  title: string;
  subtitle?: string;
  breadcrumbs: BreadcrumbEntry[];
  icon?: ReactNode;
  compact?: boolean;
};

export function AboutHero({
  title,
  subtitle,
  breadcrumbs,
  icon,
  compact = false,
}: AboutHeroProps) {
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
        alt="About hero background"
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

      {/* Scroll indicator */}
      {!compact && (
        <motion.button
          animate={{ y: [0, 10, 0] }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer"
          onClick={scrollToContent}
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        >
          <ChevronDown className="h-8 w-8 text-white/70" />
        </motion.button>
      )}
    </div>
  );
}
