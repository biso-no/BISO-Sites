"use client";

import { Card } from "@repo/ui/components/ui/card";
import { Users } from "lucide-react";
import { motion } from "motion/react";

interface Forum {
  description: string;
  id: string;
  title: string;
}

interface ForumCardProps {
  forum: Forum;
  index: number;
}

function ForumCard({ forum, index }: ForumCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <Card className="h-full border border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 hover:border-primary/20 hover:shadow-lg">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-muted">
          <Users className="h-5 w-5 text-brand-dark" />
        </div>
        <h3 className="mb-2 font-semibold text-foreground">{forum.title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {forum.description}
        </p>
      </Card>
    </motion.div>
  );
}

interface ForumListProps {
  items: Forum[];
}

export function ForumList({ items }: ForumListProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((forum, index) => (
        <ForumCard forum={forum} index={index} key={forum.id} />
      ))}
    </div>
  );
}
