"use client";

import { motion } from "motion/react";

interface TimelineEntry {
  description: string;
  id: string;
  title: string;
  year: string;
}

interface HistoryTimelineProps {
  items: TimelineEntry[];
}

export function HistoryTimeline({ items }: HistoryTimelineProps) {
  return (
    <div className="relative space-y-10 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-0.5 before:bg-border">
      {items.map((entry, index) => (
        <motion.div
          className="relative pl-10"
          initial={{ opacity: 0, x: -20 }}
          key={entry.id}
          transition={{ delay: index * 0.1, duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, x: 0 }}
        >
          <div className="absolute top-1 left-0 flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md">
            <div className="h-2 w-2 rounded-full bg-white" />
          </div>
          <span className="font-medium text-brand text-sm">{entry.year}</span>
          <h3 className="mt-1 font-semibold text-foreground text-lg">
            {entry.title}
          </h3>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            {entry.description}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
