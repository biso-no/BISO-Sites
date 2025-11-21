import React from "react";
import { cn } from "../../lib/utils";

export interface SpacerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Spacer({ size = "md" }: SpacerProps) {
  const heightClasses = {
    xs: "h-4",
    sm: "h-8",
    md: "h-16",
    lg: "h-24",
    xl: "h-32",
    "2xl": "h-48",
  };

  return <div className={cn("w-full", heightClasses[size])} />;
}
