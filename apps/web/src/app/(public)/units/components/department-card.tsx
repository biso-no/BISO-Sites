"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
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

interface DepartmentCardProps {
  department: ContentTranslations;
  index: number;
}

const typeColors: Record<string, string> = {
  committee: "bg-[#3DA9E0]/10 text-[#3DA9E0] border-[#3DA9E0]/30",
  team: "bg-purple-100 text-purple-700 border-purple-200",
  service: "bg-green-100 text-green-700 border-green-200",
};

const typeIcons: Record<string, any> = {
  committee: Target,
  team: Users,
  service: Heart,
};

const stripHtml = (html?: string | null) => {
  if (!html) return "";
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group overflow-hidden">
        {/* Card Header */}
        <div className="relative h-32 bg-linear-to-br from-[#3DA9E0] to-[#001731] p-6">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>

          <div className="relative flex items-start justify-between">
            <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              {dept?.logo ? (
                <img
                  src={dept.logo}
                  alt={department.title}
                  className="w-10 h-10 object-contain"
                />
              ) : (
                <TypeIcon className="w-8 h-8 text-white" />
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
          <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
            {department.title}
          </h3>

          <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
            {plainDescription ||
              "Denne enheten oppdaterer sin profil. Ta kontakt med campusstyret for å høre hvordan du kan bidra."}
          </p>

          {/* Meta Info */}
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <span>{dept?.campus?.name || "Ukjent"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>{boardMembersCount} medlemmer</span>
            </div>
          </div>

          {/* Social Links Count */}
          {socialsCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
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
            href={`/units/${dept?.$id || department.content_id}`}
            className="block"
          >
            <Button className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white group">
              Les mer
              <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}
