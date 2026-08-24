"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export const shouldAnimateReveal = (
  disabled: boolean,
  prefersReducedMotion: boolean | null
): boolean => !(disabled || prefersReducedMotion);

interface RevealProps {
  children: ReactNode;
  delay?: number;
  disabled?: boolean;
}

export const Reveal = ({
  children,
  delay = 0,
  disabled = false,
}: RevealProps) => {
  const prefersReducedMotion = useReducedMotion();

  if (!shouldAnimateReveal(disabled, prefersReducedMotion)) {
    return <>{children}</>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay, duration: 0.5 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
};
