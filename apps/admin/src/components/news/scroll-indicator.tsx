'use client';

import { ChevronDown } from 'lucide-react';
import { motion } from 'motion/react';

export function ScrollIndicator() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2"
      animate={{ y: [0, 10, 0] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <ChevronDown className="w-8 h-8 text-white/70" />
    </motion.div>
  );
}