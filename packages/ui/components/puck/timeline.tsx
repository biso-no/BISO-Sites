"use client";

import { cn } from "../../lib/utils";
import { motion } from "motion/react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";

export type TimelineItem = {
  date: string;
  title: string;
  description: string;
  image?: string;
  icon?: string;
};

export type TimelineProps = {
  title?: string;
  subtitle?: string;
  items: TimelineItem[];
  mode?: "alternating" | "left" | "right";
  className?: string;
  align?: "center" | "left";
  renderField?: (props: {
    children: React.ReactNode;
    name: string;
    index?: number;
    className?: string;
  }) => React.ReactNode;
};

export function Timeline({
  title,
  subtitle,
  items = [],
  mode = "alternating",
  className,
  align = "center",
  renderField = ({ children }) => <>{children}</>,
}: TimelineProps) {
  const alignClasses = {
    center: "text-center mx-auto",
    left: "text-left",
  };

  if (!items.length) {
    return (
      <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
        No timeline items added
      </div>
    );
  }

  return (
    <div className={cn("relative py-8 md:py-16", className)}>
      {(title || subtitle) && (
        <div className={cn("mb-16 max-w-3xl", alignClasses[align])}>
          {title && (
            <h2 className="mb-4 font-bold text-3xl text-foreground tracking-tight sm:text-4xl">
              {renderField({ children: title, name: "title" })}
            </h2>
          )}
          {subtitle && (
            <div className="text-lg text-muted-foreground">
              {renderField({ children: subtitle, name: "subtitle" })}
            </div>
          )}
        </div>
      )}

      {/* Vertical Line */}
      <div
        className={cn(
          "absolute top-0 bottom-0 w-px bg-border",
          mode === "left"
            ? "left-8 md:left-1/2" // In left mode, line is on left for mobile? No, let's keep it consistent.
            // Actually, if mode is "left", content is on right, line is on left.
            : mode === "right"
              ? "right-8 md:right-1/2"
              : mode === "alternating"
                ? "left-8 md:left-1/2"
                : "left-8"
        )}
      />

      <div className="space-y-12">
        {items.map((item, index) => {
          const Icon = item.icon
            ? (LucideIcons[item.icon as keyof typeof LucideIcons] as LucideIcon)
            : LucideIcons.Circle;

          const isEven = index % 2 === 0;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={cn(
                "relative flex gap-8",
                mode === "alternating"
                  ? "flex-col md:flex-row"
                  : "flex-col md:flex-row", // Always maintain flex structure
                mode === "alternating" && isEven ? "md:flex-row-reverse" : ""
              )}
            >
              {/* Timeline Dot */}
              <div
                className={cn(
                  "absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-primary bg-background z-10 flex items-center justify-center",
                  "mt-1.5" // Align with title
                )}
              >
                {/* Optional: Icon inside dot or larger dot */}
                {/* For now just a simple dot */}
              </div>

              {/* Content Side */}
              <div
                className={cn(
                  "ml-16 md:ml-0 md:w-1/2",
                  mode === "alternating"
                    ? isEven
                      ? "md:pr-12" // Right item (reversed row) -> Content is on Left
                      : "md:pl-12" // Left item (normal row) -> Content is on Right. Wait.
                    : "md:pl-12" // Non-alternating default
                )}
              >
                {/* 
                  Re-thinking alignment for Alternating:
                  Row: [Content] [Line] [Empty] (Even/Right aligned in code, but visually Left)
                  Row Reverse: [Content] [Line] [Empty] (Odd/Left aligned)
                  
                  Let's clarify "isEven". Index 0.
                  If mode is alternating:
                  Index 0: Right side? Or Left side?
                  Usually starts on Right or Left.
                  
                  If flex-row (default): 
                  [Empty/Spacer] [Line] [Content] -> This puts content on right.
                  
                  If flex-row-reverse:
                  [Content] [Line] [Empty/Spacer] -> This puts content on left.
                 */}

                <div
                  className={cn(
                    "relative",
                    mode === "alternating"
                      ? isEven
                        ? "md:text-right md:items-end" // Content on left
                        : "md:text-left md:items-start" // Content on right
                      : "text-left"
                  )}
                >
                  <div
                    className={cn(
                      "flex flex-col gap-2",
                      mode === "alternating"
                        ? isEven
                          ? "md:items-end"
                          : "md:items-start"
                        : "items-start"
                    )}
                  >
                    <span className="text-sm font-semibold text-primary tracking-wider uppercase">
                      {renderField({
                        children: item.date,
                        name: "date",
                        index,
                      })}
                    </span>
                    <h3 className="text-xl font-bold tracking-tight">
                      {renderField({
                        children: item.title,
                        name: "title",
                        index,
                      })}
                    </h3>
                    <div
                      className={cn(
                        "text-muted-foreground",
                        mode === "alternating"
                          ? isEven
                            ? "md:text-right"
                            : "md:text-left"
                          : "text-left"
                      )}
                    >
                      {renderField({
                        children: item.description,
                        name: "description",
                        index,
                      })}
                    </div>

                    {item.image && (
                      <div className="mt-4 relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Spacer Side for Alternating Layout */}
              {mode === "alternating" && <div className="hidden md:block md:w-1/2" />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
