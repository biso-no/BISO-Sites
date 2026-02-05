"use client";

import { cn } from "../../lib/utils";

export type DividerProps = {
  style?: "line" | "dashed" | "dots";
  spacing?: "sm" | "md" | "lg";
};

export function Divider({ style = "line", spacing = "md" }: DividerProps) {
  const spacingClasses = {
    sm: "my-6",
    md: "my-10",
    lg: "my-16",
  } as const;

  const styleClasses = {
    line: "border-t border-border",
    dashed: "border-t border-border border-dashed",
    dots: "border-t border-border border-dotted",
  } as const;

  return <hr className={cn(spacingClasses[spacing], styleClasses[style])} />;
}

