"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";

export function EventsHero() {
  return (
    <div className="relative h-[50vh] overflow-hidden">
      <ImageWithFallback
        alt="BISO logo"
        className="h-10 w-auto"
        height={40} // pick the intrinsic pixel width
        priority // and height that matches your asset ratio
        sizes="(max-width: 768px) 120px, 140px"
        src="/images/logo-home.png" // above-the-fold
        width={140} // control display size via CSS
      />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="mb-6 font-bold text-5xl text-white md:text-6xl">
              Discover Amazing
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Events & Experiences
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-white/90">
              From networking events to social gatherings, find the perfect
              opportunity to connect, learn, and create unforgettable memories.
            </p>
          </motion.div>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        className="-translate-x-1/2 absolute bottom-8 left-1/2"
        transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
      >
        <ChevronDown className="h-8 w-8 text-white/70" />
      </motion.div>
    </div>
  );
}
