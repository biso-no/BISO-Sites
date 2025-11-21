import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { ArrowLeft, Building2, MapPin } from "lucide-react";
import Link from "next/link";
import { SocialLinks } from "./social-links";

type DepartmentHeroProps = {
  department: ContentTranslations;
};

export function DepartmentHero({ department }: DepartmentHeroProps) {
  const dept = department.department_ref;

  // Use custom hero image if available, otherwise use default
  const DEFAULT_HERO_URL =
    "https://appwrite.biso.no/v1/storage/buckets/content/files/hero_bg/view?project=biso";
  const heroImageUrl = (dept as any)?.hero || DEFAULT_HERO_URL;

  return (
    <div className="relative h-[60vh] overflow-hidden">
      <ImageWithFallback
        alt={department.title}
        className="h-full w-full object-cover"
        fill
        src={heroImageUrl}
      />
      <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/60 to-[#001731]/85" />

      <div className="absolute inset-0">
        <div className="mx-auto flex h-full max-w-7xl items-center px-4">
          <Link
            className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-[#3DA9E0]"
            href="/units"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </Link>

          <div className="max-w-3xl">
            <div className="mb-6 flex items-center gap-4">
              {dept.logo && (
                <div className="h-20 w-20 rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm">
                  <img
                    alt={department.title}
                    className="h-full w-full object-contain"
                    src={dept.logo}
                  />
                </div>
              )}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  {dept.type && (
                    <Badge className="border-white/30 bg-white/20 text-white">
                      <Building2 className="mr-1 h-3 w-3" />
                      {dept.type.charAt(0).toUpperCase() + dept.type.slice(1)}
                    </Badge>
                  )}
                  <Badge className="border-white/30 bg-white/20 text-white">
                    <MapPin className="mr-1 h-3 w-3" />
                    {dept.campus.name}
                  </Badge>
                </div>
                <h1 className="mb-0 font-bold text-4xl text-white md:text-5xl">
                  {department.title}
                </h1>
              </div>
            </div>

            {department.short_description && (
              <p className="mb-8 max-w-2xl text-lg text-white/90">
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
