"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { ChevronDown, Heart } from "lucide-react";
import { motion } from "motion/react";

type JobsHeroProps = {
  totalPositions: number;
  paidPositions: number;
  departmentCount: number;
};

export function JobsHero({
  totalPositions,
  paidPositions,
  departmentCount,
}: JobsHeroProps) {
  return (
    <div className="relative h-[60vh] overflow-hidden">
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
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-3 backdrop-blur-sm">
              <Heart className="h-5 w-5 text-[#3DA9E0]" />
              <span className="text-white">Join Our Team</span>
            </div>
            <h1 className="mb-6 font-bold text-5xl text-white md:text-6xl">
              Make a Difference
              <br />
              <span className="bg-linear-to-r from-[#3DA9E0] via-cyan-300 to-blue-300 bg-clip-text text-transparent">
                Shape Student Life
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-white/90">
              Join BISO and be part of creating exceptional experiences for
              thousands of students. Find your perfect role and make an impact.
            </p>

            <div className="mt-8 flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="mb-1 font-bold text-3xl text-white">
                  {totalPositions}
                </div>
                <div className="text-sm text-white/80">Open Positions</div>
              </div>
              <div className="h-12 w-px bg-white/20" />
              <div className="text-center">
                <div className="mb-1 font-bold text-3xl text-white">
                  {paidPositions}
                </div>
                <div className="text-sm text-white/80">Paid Roles</div>
              </div>
              <div className="h-12 w-px bg-white/20" />
              <div className="text-center">
                <div className="mb-1 font-bold text-3xl text-white">
                  {departmentCount}
                </div>
                <div className="text-sm text-white/80">Departments</div>
              </div>
            </div>
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
