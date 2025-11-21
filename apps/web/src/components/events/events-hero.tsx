"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";

export function EventsHero() {
  return (
    <div className="relative h-[50vh] overflow-hidden">
      <ImageWithFallback
        src="/images/logo-home.png"
        alt="BISO logo"
        width={140} // pick the intrinsic pixel width
        height={40} // and height that matches your asset ratio
        sizes="(max-width: 768px) 120px, 140px"
        priority // above-the-fold
        className="h-10 w-auto" // control display size via CSS
      />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="mb-6 text-white text-5xl md:text-6xl font-bold">
              Discover Amazing
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Events & Experiences
              </span>
            </h1>
            <p className="text-white/90 text-lg max-w-2xl mx-auto">
              From networking events to social gatherings, find the perfect opportunity to connect,
              learn, and create unforgettable memories.
            </p>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <ChevronDown className="w-8 h-8 text-white/70" />
      </motion.div>
    </div>
  );
}
