"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

type AboutContentSectionProps = {
  children: ReactNode;
  className?: string;
};

export function AboutContentSection({
  children,
  className = "",
}: AboutContentSectionProps) {
  return (
    <section className={`py-16 ${className}`} id="about-content">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          className="prose prose-lg prose-primary max-w-none"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          {children}
        </motion.div>
      </div>
    </section>
  );
}

type ContentBlockProps = {
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
};

export function ContentBlock({ title, children, icon }: ContentBlockProps) {
  return (
    <motion.div
      className="mb-8 last:mb-0"
      initial={{ opacity: 0, y: 15 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {title && (
        <div className="mb-4 flex items-center gap-3">
          {icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-brand-gradient-from to-brand-gradient-to">
              {icon}
            </div>
          )}
          <h2 className="font-semibold text-foreground text-xl">{title}</h2>
        </div>
      )}
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </motion.div>
  );
}

type HighlightListProps = {
  items: string[];
};

export function HighlightList({ items }: HighlightListProps) {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {items.map((item, index) => (
        <motion.li
          className="flex items-start gap-3"
          initial={{ opacity: 0, x: -10 }}
          key={index}
          transition={{ delay: index * 0.1, duration: 0.3 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, x: 0 }}
        >
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-linear-to-br from-brand-gradient-from to-brand-gradient-to" />
          <span className="text-muted-foreground">{item}</span>
        </motion.li>
      ))}
    </ul>
  );
}
