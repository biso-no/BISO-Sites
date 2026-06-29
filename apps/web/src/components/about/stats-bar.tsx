"use client";

import { Card } from "@repo/ui/components/ui/card";
import { motion } from "motion/react";

interface Stat {
  id: string;
  label: string;
  value: string;
}

interface StatsBarProps {
  items: Stat[];
}

export function StatsBar({ items }: StatsBarProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {items.map((stat, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          key={stat.id}
          transition={{ delay: index * 0.1, duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Card className="p-8 text-center">
            <div className="bg-linear-to-r from-brand-gradient-from to-brand-gradient-to bg-clip-text font-bold text-4xl text-transparent">
              {stat.value}
            </div>
            <p className="mt-2 text-muted-foreground text-sm">{stat.label}</p>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
