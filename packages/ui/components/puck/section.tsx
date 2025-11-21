import React, { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface SectionProps {
  children?: ReactNode;
  className?: string;
  backgroundColor?: "white" | "gray" | "primary" | "primary-strong" | "dark";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  maxWidth?: "default" | "full" | "narrow";
  id?: string;
}

export function Section({
  children,
  className,
  backgroundColor = "white",
  padding = "md",
  maxWidth = "default",
  id,
}: SectionProps) {
  const bgClasses = {
    white: "bg-white",
    gray: "bg-gray-50",
    primary: "bg-primary/5",
    "primary-strong": "bg-primary text-primary-foreground",
    dark: "bg-slate-950 text-white",
  };

  const paddingClasses = {
    none: "py-0",
    sm: "py-8 md:py-12",
    md: "py-12 md:py-16",
    lg: "py-16 md:py-24",
    xl: "py-24 md:py-32",
  };

  const widthClasses = {
    default: "max-w-7xl",
    full: "max-w-full",
    narrow: "max-w-3xl",
  };

  return (
    <section
      id={id}
      className={cn(
        "relative w-full",
        bgClasses[backgroundColor],
        paddingClasses[padding],
        className
      )}
    >
      <div
        className={cn(
          "mx-auto px-4 sm:px-6 lg:px-8",
          widthClasses[maxWidth]
        )}
      >
        {children}
      </div>
    </section>
  );
}
