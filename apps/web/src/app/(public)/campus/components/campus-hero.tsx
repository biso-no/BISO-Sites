"use client";

import { motion } from "motion/react";
import { Sparkles, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { ImageWithFallback } from "@repo/ui/components/image";
import type { CampusMetadata } from "@repo/api/types/appwrite";
import type { Locale } from "@/i18n/config";

interface CampusHeroProps {
  campusName: string | null;
  campusMetadata: CampusMetadata | null;
  stats: {
    departments: number;
    events: number;
    jobs: number;
  };
  locale: Locale;
}

const StatPill = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-left shadow-glow">
    <div className="text-xl font-semibold text-white">{value}</div>
    <div className="text-xs uppercase tracking-wide text-white/70">{label}</div>
  </div>
);

export function CampusHero({ campusName, campusMetadata, stats, locale }: CampusHeroProps) {
  const tagline = campusMetadata
    ? (locale === "en" ? campusMetadata.tagline_en : campusMetadata.tagline_nb) || 
      campusMetadata.tagline_en || 
      campusMetadata.tagline_nb
    : "Where Innovation Meets Opportunity";

  const description = campusMetadata
    ? (locale === "en" ? campusMetadata.description_en : campusMetadata.description_nb) ||
      campusMetadata.description_en ||
      campusMetadata.description_nb
    : "BISO is the heart of student life at BI Norwegian Business School. Join us to create unforgettable experiences, foster career growth, and build a vibrant community.";

  const highlights = campusMetadata
    ? (locale === "en" ? campusMetadata.highlights_en : campusMetadata.highlights_nb) ||
      campusMetadata.highlights_en ||
      campusMetadata.highlights_nb ||
      []
    : [];

  const location = campusMetadata?.campus_name 
    ? `${campusMetadata.campus_name}, Norway`
    : campusName ? `${campusName}, Norway` : "Norway";

  const statsData = [
    {
      label: locale === "en" ? "Active Units" : "Aktive enheter",
      value: stats.departments || "--",
    },
    {
      label: locale === "en" ? "Upcoming Events" : "Kommende arrangementer",
      value: stats.events || "--",
    },
    {
      label: locale === "en" ? "Open Positions" : "Ledige verv",
      value: stats.jobs || "--",
    },
  ];

  return (
    <div className="relative h-[70vh] overflow-hidden">
      <ImageWithFallback
        src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzfGVufDF8fHx8MTc2MjE2NTE0NXww&ixlib=rb-4.1.0&q=80&w=1080"
        alt={campusName ? `${campusName} Campus` : "BISO Campus"}
        fill
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />
      
      <div className="absolute inset-0">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl"
          >
            <Badge className="mb-4 bg-[#3DA9E0]/20 text-white border-white/30">
              <MapPin className="w-3 h-3 mr-1" />
              {location}
            </Badge>
            <h1 className="mb-6 text-white text-5xl font-bold">
              {campusName ? `BISO ${campusName}` : locale === "en" ? "BISO - Student Life" : "BISO - Studentliv"}
            </h1>
            <p className="text-white/90 mb-8 text-xl">
              {tagline}
            </p>
            <p className="text-white/80 mb-8 text-lg max-w-2xl">
              {description}
            </p>
            
            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {highlights.map((highlight, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    className="flex items-center gap-2 text-white/90"
                  >
                    <Sparkles className="w-4 h-4 text-[#3DA9E0]" />
                    <span>{highlight}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <Button asChild size="lg" className="bg-white text-primary-100 hover:bg-white/90">
                <Link href="/membership">
                  {locale === "en" ? "Become a Member" : "Bli medlem"}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/events">
                  {locale === "en" ? "See Events" : "Se arrangementer"}
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/jobs">
                  {locale === "en" ? "Find a Position" : "Finn et verv"}
                </Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-3">
              {statsData.map((stat) => (
                <StatPill key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
