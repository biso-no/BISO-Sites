"use client";

import { Switch } from "@repo/ui/components/ui/switch";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToggleSectionProps = {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: ReactNode;
  icon?: React.ElementType;
  className?: string;
};

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
      <div className="mb-2 flex items-start justify-between">
        <div className="flex flex-1 items-center gap-2">
          {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
          <div className="flex-1">
            <h4 className="font-semibold text-base">{title}</h4>
            <p className="mt-1 text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          className="ml-4 shrink-0"
          onCheckedChange={onToggle}
        />
      </div>
      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            animate={{ height: "auto", opacity: 1, marginTop: 16 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
