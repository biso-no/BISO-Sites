"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
 ChevronRight,
 Heart,
 MapPin,
 Sparkles,
 Target,
 Users,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

type DepartmentCardProps = {
 department: ContentTranslations;
 index: number;
};

const typeColors: Record<string, string> = {
 committee: "bg-brand-muted text-brand border-brand-border-strong",
 team: "bg-purple-100 text-purple-700 border-purple-200",
 service: "bg-green-100 text-green-700 border-green-200",
};

const typeIcons: Record<string, any> = {
 committee: Target,
 team: Users,
 service: Heart,
};

const stripHtml = (html?: string | null) => {
 if (!html) {
 return "";
 }
 return html
 .replace(/<[^>]+>/g, " ")
 .replace(/\s+/g, " ")
 .trim();
};

export function DepartmentCard({ department, index }: DepartmentCardProps) {
 const dept = department.department_ref;
 const TypeIcon = typeIcons[dept?.type || "committee"] || Target;
 const typeColor =
 typeColors[dept?.type || "committee"] || typeColors.committee;
 const plainDescription = stripHtml(
 department.short_description || department.description
 );

 const socialsCount = dept?.socials?.length || 0;
 const boardMembersCount = dept?.boardMembers?.length || 0;

 return (
 <motion.div
 animate={{ opacity: 1, y: 0 }}
 initial={{ opacity: 0, y: 20 }}
 transition={{ delay: index * 0.1 }}
 >
 <Card className="group h-full cursor-pointer overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl">
 {/* Card Header */}
 <div className="relative h-32 bg-linear-to-br from-brand-gradient-from to-brand-gradient-to p-6">
 <div className="absolute inset-0 opacity-10">
 <div className="-translate-y-1/2 absolute top-0 right-0 h-32 w-32 translate-x-1/2 rounded-full bg-background" />
 <div className="-translate-x-1/2 absolute bottom-0 left-0 h-24 w-24 translate-y-1/2 rounded-full bg-background" />
 </div>

 <div className="relative flex items-start justify-between">
 <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/30 bg-background/20 backdrop-blur-sm transition-transform group-hover:scale-110">
 {dept?.logo ? (
 <ImageWithFallback
 alt={department.title}
 className="h-10 w-10 object-contain"
 height={40}
 src={dept.logo}
 width={40}
 />
 ) : (
 <TypeIcon className="h-8 w-8 text-white" />
 )}
 </div>

 {dept?.type && (
 <Badge className={typeColor}>
 {dept.type.charAt(0).toUpperCase() + dept.type.slice(1)}
 </Badge>
 )}
 </div>
 </div>

 {/* Card Body */}
 <div className="p-6">
 <h3 className="mb-2 font-semibold text-foreground text-xl transition-colors group-hover:text-primary">
 {department.title}
 </h3>

 <p className="mb-4 line-clamp-3 text-muted-foreground text-sm">
 {plainDescription ||
 "Denne enheten oppdaterer sin profil. Ta kontakt med campusstyret for å høre hvordan du kan bidra."}
 </p>

 {/* Meta Info */}
 <div className="mb-4 flex items-center justify-between text-muted-foreground text-sm">
 <div className="flex items-center gap-2">
 <MapPin className="h-4 w-4 text-primary" />
 <span>{dept?.campus?.name || "Ukjent"}</span>
 </div>
 <div className="flex items-center gap-2">
 <Users className="h-4 w-4 text-primary" />
 <span>{boardMembersCount} medlemmer</span>
 </div>
 </div>

 {/* Social Links Count */}
 {socialsCount > 0 && (
 <div className="flex items-center gap-2 text-muted-foreground text-sm">
 <Sparkles className="h-4 w-4 text-primary" />
 <span>
 Aktiv på {socialsCount} plattform
 {socialsCount !== 1 ? "er" : ""}
 </span>
 </div>
 )}
 </div>

 {/* Card Footer */}
 <div className="px-6 pb-6">
 <Link
 className="block"
 href={`/units/${dept?.$id || department.content_id}`}
 >
 <Button className="group w-full bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white hover:from-brand-gradient-from/90 hover:to-brand-gradient-to/90">
 Les mer
 <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
 </Button>
 </Link>
 </div>
 </Card>
 </motion.div>
 );
}
