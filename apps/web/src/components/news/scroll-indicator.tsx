"use client";

import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";

export function ScrollIndicator() {
  return (
    <motion.div
      animate={{ y: [0, 10, 0] }}
      className="-translate-x-1/2 absolute bottom-8 left-1/2"
      transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
    >
      <ChevronDown className="h-8 w-8 text-white/70" />
    </motion.div>
  );
}
