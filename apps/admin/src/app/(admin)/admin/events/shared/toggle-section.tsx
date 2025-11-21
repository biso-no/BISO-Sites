"use client";

import { Switch } from "@repo/ui/components/ui/switch";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ToggleSectionProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: ReactNode;
  icon?: React.ElementType;
  className?: string;
}

export function ToggleSection({
  title,
  description,
  enabled,
  onToggle,
  children,
  icon: Icon,
  className,
}: ToggleSectionProps) {
  return (
    <div
      className={cn(
        "toggle-section transition-all duration-300",
        enabled && "enabled",
        className
      )}
      style={{
        transform: enabled ? "scale(1)" : "scale(0.98)",
        opacity: enabled ? 1 : 0.85,
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          {Icon && <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />}
          <div className="flex-1">
            <h4 className="font-semibold text-base">{title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          className="shrink-0 ml-4"
        />
      </div>
      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 16 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
