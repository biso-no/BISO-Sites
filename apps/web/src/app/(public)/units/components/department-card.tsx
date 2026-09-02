"use client";

import { resolveStorageFileUrl } from "@repo/api/storage";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import {
  parseUnitCategory,
  UNIT_CATEGORY_MESSAGE_KEYS,
  type UnitCategory,
} from "@repo/shared/utils/unit-categories";
import { unitCanonicalPath } from "@repo/shared/utils/unit-urls";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import {
  Briefcase,
  ChevronRight,
  Flag,
  GraduationCap,
  MapPin,
  Rocket,
  Shapes,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface DepartmentCardProps {
  department: ContentTranslations;
  index: number;
}

const CATEGORY_COLORS: Record<UnitCategory, string> = {
  society: "bg-purple-100 text-purple-700 border-purple-200",
  academic_association: "bg-brand-muted text-brand border-brand-border-strong",
  project: "bg-amber-100 text-amber-700 border-amber-200",
  staff_function: "bg-green-100 text-green-700 border-green-200",
  national: "bg-blue-100 text-blue-700 border-blue-200",
  other: "bg-muted text-muted-foreground border-border",
};

const CATEGORY_ICONS: Record<
  UnitCategory,
  React.ComponentType<{ className?: string }>
> = {
  society: Users,
  academic_association: GraduationCap,
  project: Rocket,
  staff_function: Briefcase,
  national: Flag,
  other: Shapes,
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
  // Category labels live in the shared `jobs.filters` bundle so units and jobs
  // name the same categories identically.
  const t = useTranslations("jobs");
  const dept = department.department_ref;
  const category = parseUnitCategory(dept?.type);
  const CategoryIcon = category ? CATEGORY_ICONS[category] : Target;
  // `departments.logo` is a string(100), so the admin editor stores a bare
  // Appwrite file id rather than a full view URL. Expand it before rendering.
  const logoUrl = resolveStorageFileUrl(dept?.logo);
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
            <div className="absolute top-0 right-0 h-32 w-32 translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
            <div className="absolute bottom-0 left-0 h-24 w-24 -translate-x-1/2 translate-y-1/2 rounded-full bg-background" />
          </div>

          <div className="relative flex items-start justify-between">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/30 bg-background/20 backdrop-blur-sm transition-transform group-hover:scale-110">
              {logoUrl ? (
                <ImageWithFallback
                  alt={department.title}
                  className="h-10 w-10 object-contain"
                  height={40}
                  src={logoUrl}
                  width={40}
                />
              ) : (
                <CategoryIcon className="h-8 w-8 text-white" />
              )}
            </div>

            {category && (
              <Badge className={CATEGORY_COLORS[category]}>
                {t(`filters.${UNIT_CATEGORY_MESSAGE_KEYS[category]}`)}
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
                {socialsCount === 1 ? "" : "er"}
              </span>
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="px-6 pb-6">
          <Link
            className="block"
            href={
              unitCanonicalPath({
                campusId: dept?.campus_id,
                slug: dept?.slug,
              }) ?? `/units/${dept?.$id || department.content_id}`
            }
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
