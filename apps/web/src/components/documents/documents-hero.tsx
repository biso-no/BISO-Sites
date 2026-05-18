"use client";

import { FileText } from "lucide-react";
import { motion } from "motion/react";

export function DocumentsHero() {
  return (
    <div className="relative overflow-hidden py-24 text-center">
      {/* Floating orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.3, 0.2] }}
        className="pointer-events-none absolute top-10 right-20 h-96 w-96 rounded-full"
        style={{
          background: "#3DA9E0",
          filter: "blur(120px)",
          opacity: 0.2,
        }}
        transition={{
          duration: 8,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.25, 0.15] }}
        className="pointer-events-none absolute bottom-0 left-10 h-80 w-80 rounded-full"
        style={{
          background: "#3DA9E0",
          filter: "blur(100px)",
          opacity: 0.15,
        }}
        transition={{
          duration: 10,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mx-auto max-w-3xl px-6"
        initial={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
      >
        <div
          className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(61,169,224,0.30)",
            backdropFilter: "blur(8px)",
          }}
        >
          <FileText className="h-4 w-4" style={{ color: "#3DA9E0" }} />
          <span className="text-sm tracking-wide" style={{ color: "#3DA9E0" }}>
            OFFICIAL DOCUMENTATION
          </span>
        </div>

        <h1 className="mb-6 font-bold text-5xl text-white tracking-tight md:text-6xl">
          BISO Documents
        </h1>

        <p
          className="text-xl leading-relaxed"
          style={{ color: "rgba(255,255,255,0.70)" }}
        >
          Access important organizational documents, bylaws, and guidelines that
          govern the BI Student Organisation across all campuses.
        </p>
      </motion.div>
    </div>
  );
}
