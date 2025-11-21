import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { ArrowLeft, Building2, MapPin } from "lucide-react";
import Link from "next/link";
import { SocialLinks } from "./social-links";

interface DepartmentHeroProps {
  department: ContentTranslations;
}

export function DepartmentHero({ department }: DepartmentHeroProps) {
  const dept = department.department_ref;

  // Use custom hero image if available, otherwise use default
  const DEFAULT_HERO_URL =
    "https://appwrite.biso.no/v1/storage/buckets/content/files/hero_bg/view?project=biso";
  const heroImageUrl = (dept as any)?.hero || DEFAULT_HERO_URL;

  return (
    <div className="relative h-[60vh] overflow-hidden">
      <ImageWithFallback
        src={heroImageUrl}
        alt={department.title}
        fill
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />

      <div className="absolute inset-0">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center">
          <Link
            href="/units"
            className="absolute top-8 left-8 flex items-center gap-2 text-white hover:text-[#3DA9E0] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Link>

          <div className="max-w-3xl">
            <div className="flex items-center gap-4 mb-6">
              {dept.logo && (
                <div className="w-20 h-20 rounded-xl bg-white/10 backdrop-blur-sm p-3 border border-white/20">
                  <img
                    src={dept.logo}
                    alt={department.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
              <div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  {dept.type && (
                    <Badge className="bg-white/20 text-white border-white/30">
                      <Building2 className="w-3 h-3 mr-1" />
                      {dept.type.charAt(0).toUpperCase() + dept.type.slice(1)}
                    </Badge>
                  )}
                  <Badge className="bg-white/20 text-white border-white/30">
                    <MapPin className="w-3 h-3 mr-1" />
                    {dept.campus.name}
                  </Badge>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-0">
                  {department.title}
                </h1>
              </div>
            </div>

            {department.short_description && (
              <p className="text-white/90 text-lg mb-8 max-w-2xl">
                {department.short_description}
              </p>
            )}

            {/* Social Links */}
            {dept.socials && dept.socials.length > 0 && (
              <SocialLinks socials={dept.socials} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
