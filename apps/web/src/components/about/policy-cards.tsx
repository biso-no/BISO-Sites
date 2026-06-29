"use client";

import { Card } from "@repo/ui/components/ui/card";
import { Target } from "lucide-react";
import { motion } from "motion/react";

interface PolicyCardItem {
  description: string;
  id: string;
  title: string;
}

interface PolicyCardsProps {
  items: PolicyCardItem[];
}

export function PolicyCards({ items }: PolicyCardsProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {items.map((item, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          key={item.id}
          transition={{ delay: index * 0.08, duration: 0.4 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Card className="group h-full border border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-gradient-from to-brand-gradient-to shadow-md transition-transform duration-300 group-hover:scale-110">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
