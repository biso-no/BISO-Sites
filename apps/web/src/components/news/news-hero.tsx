"use client";

import { Newspaper } from "lucide-react";
import { motion } from "motion/react";
import { BackButton } from "./back-button";
import { ScrollIndicator } from "./scroll-indicator";

export function NewsHero() {
  return (
    <div className="relative h-[50vh] overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <BackButton />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Newspaper className="w-12 h-12 text-[#3DA9E0]" />
            </div>
            <h1 className="mb-6 text-white text-4xl md:text-5xl lg:text-6xl font-bold">
              Latest News &
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Student Stories
              </span>
            </h1>
            <p className="text-white/90 max-w-2xl mx-auto text-lg">
              Stay updated with the latest happenings, achievements, and stories
              from the BISO community.
            </p>
          </motion.div>
        </div>
      </div>

      <ScrollIndicator />
    </div>
  );
}
