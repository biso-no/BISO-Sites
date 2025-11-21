"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AnimatedBadgeProps {
  children: ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
  icon?: LucideIcon;
  pulse?: boolean;
  gradient?: boolean;
  className?: string;
}

export function AnimatedBadge({
  children,
  variant = "default",
  icon: Icon,
  pulse = false,
  gradient = false,
  className,
}: AnimatedBadgeProps) {
  const gradientVariants = {
    default: "bg-linear-to-r from-primary to-primary/80 text-primary-foreground border-0",
    secondary: "bg-linear-to-r from-secondary to-secondary/80 text-secondary-foreground border-0",
    destructive:
      "bg-linear-to-r from-destructive to-destructive/80 text-destructive-foreground border-0",
    success: "bg-linear-to-r from-green-500 to-green-600 text-white border-0",
    warning: "bg-linear-to-r from-amber-500 to-amber-600 text-white border-0",
    outline: "bg-linear-to-r from-transparent to-transparent",
  };

  return (
    <Badge
      variant={gradient ? undefined : variant}
      className={cn(
        "transition-all duration-300 hover:scale-105",
        pulse && "animate-pulse",
        gradient && gradientVariants[variant],
        "shadow-sm",
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {children}
    </Badge>
  );
}
