import React, { type ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface ColumnsProps {
  children?: ReactNode;
  layout?: "1:1" | "2:1" | "1:2" | "1:1:1" | "1:1:1:1";
  gap?: "sm" | "md" | "lg";
  verticalAlign?: "top" | "center" | "bottom";
  className?: string;
}

export function Columns({
  children,
  layout = "1:1",
  gap = "md",
  verticalAlign = "top",
  className,
}: ColumnsProps) {
  const layoutClasses = {
    "1:1": "grid-cols-1 md:grid-cols-2",
    "2:1": "grid-cols-1 md:grid-cols-[2fr_1fr]",
    "1:2": "grid-cols-1 md:grid-cols-[1fr_2fr]",
    "1:1:1": "grid-cols-1 md:grid-cols-3",
    "1:1:1:1": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  const gapClasses = {
    sm: "gap-4",
    md: "gap-8",
    lg: "gap-12",
  };

  const alignClasses = {
    top: "items-start",
    center: "items-center",
    bottom: "items-end",
  };

  return (
    <div
      className={cn(
        "grid w-full",
        layoutClasses[layout],
        gapClasses[gap],
        alignClasses[verticalAlign],
        className,
      )}
    >
      {children}
    </div>
  );
}
