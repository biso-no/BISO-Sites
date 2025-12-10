"use client";

import type { CampusMetadata } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { MapPin, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect } from "react";
import { useCampus } from "@/components/context/campus";

type CampusHeroProps = {
 campusName: string | null;
 campusMetadata: CampusMetadata | null;
 stats: {
 departments: number;
 events: number;
 jobs: number;
 };
 locale: Locale;
};

const DEFAULT_TAGLINE = "Where Innovation Meets Opportunity";
const DEFAULT_DESCRIPTION =
 "BISO is the heart of student life at BI Norwegian Business School. Join us to create unforgettable experiences, foster career growth, and build a vibrant community.";

const getLocalizedContent = ({
 locale,
 enValue,
 nbValue,
 fallback,
}: {
 locale: Locale;
 enValue?: string | null;
 nbValue?: string | null;
 fallback: string;
}) => {
 const englishFirst = locale === "en";
 const preferred = englishFirst ? enValue : nbValue;
 const secondary = englishFirst ? nbValue : enValue;
 return preferred || secondary || fallback;
};

const getHighlights = ({
 locale,
 enHighlights,
 nbHighlights,
}: {
 locale: Locale;
 enHighlights?: string[] | null;
 nbHighlights?: string[] | null;
}) => {
 const englishFirst = locale === "en";
 const preferred = englishFirst ? enHighlights : nbHighlights;
 const secondary = englishFirst ? nbHighlights : enHighlights;
 return preferred || secondary || [];
};

const getLocation = ({
 campusMetadata,
 campusName,
}: {
 campusMetadata: CampusMetadata | null;
 campusName: string | null;
}) => {
 if (campusMetadata?.campus_name) {
 return `${campusMetadata.campus_name}, Norway`;
 }
 if (campusName) {
 return `${campusName}, Norway`;
 }
 return "Norway";
};

const getHeroTitle = ({
 campusName,
 locale,
}: {
 campusName: string | null;
 locale: Locale;
}) => {
 if (campusName) {
 return `BISO ${campusName}`;
 }
 return locale === "en" ? "BISO - Student Life" : "BISO - Studentliv";
};

const getStatsData = ({
 stats,
 locale,
}: {
 stats: CampusHeroProps["stats"];
 locale: Locale;
}) => {
 const english = locale === "en";
 return [
 {
 label: english ? "Active Units" : "Aktive enheter",
 value: stats.departments || "--",
 },
 {
 label: english ? "Upcoming Events" : "Kommende arrangementer",
 value: stats.events || "--",
 },
 {
 label: english ? "Open Positions" : "Ledige verv",
 value: stats.jobs || "--",
 },
 ];
};

const StatPill = ({
 label,
 value,
}: {
 label: string;
 value: string | number;
}) => (
 <div className="rounded-xl border border-white/20 bg-background/10 px-4 py-3 text-left shadow-glow">
 <div className="font-semibold text-white text-xl">{value}</div>
 <div className="text-white/70 text-xs uppercase tracking-wide">{label}</div>
 </div>
);

export function CampusHero({
 campusName,
 campusMetadata,
 stats,
 locale,
}: CampusHeroProps) {
    const { activeCampus, loading } = useCampus();

 const tagline = getLocalizedContent({
 locale,
 enValue: campusMetadata?.tagline_en,
 nbValue: campusMetadata?.tagline_nb,
 fallback: DEFAULT_TAGLINE,
 });

 const description = getLocalizedContent({
 locale,
 enValue: campusMetadata?.description_en,
 nbValue: campusMetadata?.description_nb,
 fallback: DEFAULT_DESCRIPTION,
 });

 const highlights = campusMetadata
 ? getHighlights({
 locale,
 enHighlights: campusMetadata.highlights_en,
 nbHighlights: campusMetadata.highlights_nb,
 })
 : [];

 const location = getLocation({ campusMetadata, campusName });
 const heroTitle = getHeroTitle({ campusName, locale });
 const statsData = getStatsData({ stats, locale });

 const heroImage = activeCampus?.name
    ? `/images/campus/${activeCampus.name.toLowerCase()}.png`
    : null;


 if (loading || !heroImage) {
    return (
      <div className="relative flex h-[70vh] items-center justify-center overflow-hidden bg-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

 return (
 <div className="relative h-[70vh] overflow-hidden">
 <ImageWithFallback
 alt={activeCampus?.name ? `${activeCampus.name} Campus` : "BISO Campus"}
 className="h-full w-full object-cover"
 fill
 src={heroImage}
 />
 <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

 <div className="absolute inset-0">
 <div className="mx-auto flex h-full max-w-7xl items-center px-4">
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 className="max-w-3xl"
 initial={{ opacity: 0, y: 30 }}
 transition={{ duration: 0.8 }}
 >
 <Badge className="mb-4 border-white/30 bg-brand-muted-strong text-white">
 <MapPin className="mr-1 h-3 w-3" />
 {location}
 </Badge>
 <h1 className="mb-6 font-bold text-5xl text-white">{heroTitle}</h1>
 <p className="mb-8 text-white/90 text-xl">{tagline}</p>
 <p className="mb-8 max-w-2xl text-lg text-white/80">
 {description}
 </p>

 {/* Highlights */}
 {highlights.length > 0 && (
 <div className="mb-8 grid gap-3 sm:grid-cols-2">
 {highlights.map((highlight, index) => (
 <motion.div
 animate={{ opacity: 1, x: 0 }}
 className="flex items-center gap-2 text-white/90"
 initial={{ opacity: 0, x: -20 }}
 key={index}
 transition={{ delay: 0.2 + index * 0.1 }}
 >
 <Sparkles className="h-4 w-4 text-brand" />
 <span>{highlight}</span>
 </motion.div>
 ))}
 </div>
 )}

 {/* CTA Buttons */}
 <div className="mb-6 flex flex-wrap gap-3">
 <Button
 asChild
 className="bg-background text-primary-100 hover:bg-background/90"
 size="lg"
 >
 <Link href="/membership">
 {locale === "en" ? "Become a Member" : "Bli medlem"}
 </Link>
 </Button>
 <Button
 asChild
 className="border-white/40 bg-background/10 text-white hover:bg-background/20 hover:text-white"
 size="lg"
 variant="outline"
 >
 <Link href="/events">
 {locale === "en" ? "See Events" : "Se arrangementer"}
 </Link>
 </Button>
 <Button
 asChild
 className="text-white hover:bg-background/10 hover:text-white"
 size="lg"
 variant="ghost"
 >
 <Link href="/jobs">
 {locale === "en" ? "Find a Position" : "Finn et verv"}
 </Link>
 </Button>
 </div>

 {/* Stats */}
 <div className="flex flex-wrap gap-3">
 {statsData.map((stat) => (
 <StatPill
 key={stat.label}
 label={stat.label}
 value={stat.value}
 />
 ))}
 </div>
 </motion.div>
 </div>
 </div>
 </div>
 );
}
