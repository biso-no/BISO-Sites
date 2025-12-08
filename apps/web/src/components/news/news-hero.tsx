"use client";

import { Newspaper } from "lucide-react";
import { motion } from "motion/react";
import { BackButton } from "./back-button";
import { ScrollIndicator } from "./scroll-indicator";

export function NewsHero() {
 return (
 <div className="relative h-[50vh] overflow-hidden">
 <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

 <div className="absolute inset-0 flex items-center justify-center">
 <div className="mx-auto max-w-4xl px-4 text-center">
 <BackButton />

 <motion.div
 animate={{ opacity: 1, y: 0 }}
 initial={{ opacity: 0, y: 30 }}
 transition={{ duration: 0.8 }}
 >
 <div className="mb-4 flex items-center justify-center gap-2">
 <Newspaper className="h-12 w-12 text-brand" />
 </div>
 <h1 className="mb-6 font-bold text-4xl text-white md:text-5xl lg:text-6xl">
 Latest News &
 <br />
 <span className="bg-linear-to-r from-brand-gradient-from via-cyan-300 to-blue-300 bg-clip-text text-transparent">
 Student Stories
 </span>
 </h1>
 <p className="mx-auto max-w-2xl text-lg text-white/90">
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
